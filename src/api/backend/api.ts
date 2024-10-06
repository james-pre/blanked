/* eslint-disable @typescript-eslint/only-throw-error */
import { createHash, randomBytes } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import { StatusCodes } from 'http-status-codes';
import type { AccountType } from '../accounts';
import { checkAccountAttribute, isValidAccountAttribute, type Account, type FullAccount } from '../accounts';
import { error } from './utils';

let db: D1Database;

export function setDB(value: D1Database) {
	db = value;
}

export function getDB(): D1Database {
	if (!db) {
		throw error(StatusCodes.SERVICE_UNAVAILABLE, 'Could not access database');
	}
	return db;
}

export function hash(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

export async function sendMail(to: string, subject: string, contents: string) {
	if (!globalThis.process) {
		return;
	}
	await fetch('https://api.sendgrid.com/v3/mail/send', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer ' + globalThis.process.env.sendgrid_api_key,
		},
		body: JSON.stringify({
			from: 'Blankstorm <no-reply@blankstorm.net>',
			to,
			subject,
			html: '<p style="font-family:sans-serif">' + contents.replaceAll('\n', '<br>') + '</p>',
		}),
	});
}

export function sendMailToUser({ username, email }: { username: string; email?: string }, subject: string, contents: string) {
	if (!email) {
		throw 'Missing email';
	}
	return sendMail(`${username} <${email}>`, subject, `${username},\n\n${contents}\n\nBest,\nThe Blankstorm dev team`);
}

export async function getAccountNum(): Promise<number> {
	return (await getDB().prepare('select count(1) as num from accounts').first<number>('num'))!;
}

export async function getAccount(attr: string, value: string): Promise<FullAccount> {
	const result = await getAccounts(attr, value, 0, 1);
	return result[0];
}

export async function getAccounts(attr: string, value: string, offset = 0, limit = 1000): Promise<FullAccount[]> {
	if (!value) {
		return [];
	}
	const { results } = await getDB().prepare(`select * from accounts where ${attr}=? limit ?,?`).bind(value, offset, limit).all<FullAccount>();
	for (const result of results) {
		result.is_disabled = !!result.is_disabled;
	}
	return results;
}

export async function getAllAccounts(offset = 0, limit = 1000): Promise<FullAccount[]> {
	const { results } = await getDB().prepare('select * from accounts limit ?,?').bind(offset, limit).all<FullAccount>();
	for (const result of results) {
		result.is_disabled = !!result.is_disabled;
	}
	return results;
}

export async function getAllAccountsWithMinType(type: AccountType = 4, offset = 0, limit = 1000): Promise<FullAccount[]> {
	const { results } = await getDB().prepare('select * from accounts where type >= ? limit ?,?').bind(type, offset, limit).all<FullAccount>();
	for (const result of results) {
		result.is_disabled = !!result.is_disabled;
	}
	return results;
}

export async function setAccountAttribute(id: string, attr: string, value: string, reason?: string): Promise<void> {
	if (!isValidAccountAttribute(attr as keyof FullAccount, value)) {
		throw 'Invalid key or value';
	}

	const user = await getAccount('id', id);
	if (!user) {
		return;
	}
	const date = new Date(Date.now());
	switch (attr) {
		case 'username':
			await sendMailToUser(
				user,
				'Username changed',
				'Your username has been changed. If this was not you, you should change your password and contact support@blankstorm.net.'
			);
			await getDB().prepare('update accounts set lastchange=?,username=? where id=?').bind(date, value, id).all();
			break;
		case 'password':
			await sendMailToUser(
				user,
				'Password changed',
				'Your password has been changed. If this was not you, you should change your password and contact support@blankstorm.net.'
			);
			await getDB().prepare('update accounts set password=? where id=?').bind(hash(value), id).run();
			break;
		case 'disabled':
			await sendMailToUser(
				user,
				'Account ' + (value ? 'disabled' : 'enabled'),
				`Your account has been ${value ? 'disabled' : 'enabled'}.\nReason: ${reason || '<em>no reason provided</em>'}`
			);
			break;
		case 'email':
			await sendMailToUser(
				user,
				'Email changed',
				`Your email has been changed to ${value}. If this was not you, you should change your password and contact support@blankstorm.net.`
			);
			break;
	}

	await getDB().prepare(`update accounts set ${attr}=? where id=?`).bind(value, id).run();
	return;
}

export async function createAccount(username: string, email: string, rawPassword: string): Promise<Account> {
	checkAccountAttribute('username', username);
	checkAccountAttribute('email', email);
	checkAccountAttribute('password', rawPassword);

	if ((await getAccounts('username', username)).length) {
		throw new ReferenceError('User with username already exists');
	}

	if ((await getAccounts('email', email)).length) {
		throw new ReferenceError('User with email already exists');
	}

	const id = randomBytes(16).toString('hex');
	const password = hash(rawPassword);
	const date = new Date(Date.now());

	if ((await getAccounts('id', id)).length) {
		throw new ReferenceError('User with id already exists');
	}

	await getDB().prepare('insert into accounts (id,username,email,password,type) values (?,?,?,?,0)').bind(id, username, email, password).all();

	await sendMailToUser(
		{ username, email },
		'Welcome to Blankstorm',
		`Thank you for joining Blankstorm! The game is still in development, so not all the features are completly finished.`
	);

	return {
		id,
		is_disabled: false,
		username,
		email,
		type: 0,
		created: date,
		lastchange: date,
	};
}

export async function accountExists(id: string): Promise<boolean> {
	const { results } = await getDB().prepare('select count(1) as num from accounts where id=?').bind(id).all();
	return !!results[0].num;
}

export async function deleteAccount(id: string, reason?: string): Promise<FullAccount> {
	if (!(await accountExists(id))) {
		throw new ReferenceError('User does not exist');
	}

	const user = await getAccount('id', id);
	await sendMailToUser(
		user,
		'Account deleted',
		`Your account has been deleted.
		Reason: ${reason || '<em>no reason provided</em>'}
		If you have any concerns please reach out to support@blankstorm.net.`
	);

	return (await getDB().prepare('delete from accounts where id=?').bind(id).first())!;
}

export async function login(id: string): Promise<string> {
	const token = randomBytes(32).toString('hex');
	await getDB().prepare('update accounts set token=? where id=?').bind(token, id).first();
	return token;
}

export async function logout(id: string, reason?: string): Promise<boolean> {
	return (await getDB().prepare('update accounts set token="" where id=?').bind(id).first())!;
}

export async function generateSession(id: string): Promise<string> {
	const session = randomBytes(32).toString('hex');
	await getDB().prepare('update accounts set session=? where id=?').bind(session, id).first();
	return session;
}
