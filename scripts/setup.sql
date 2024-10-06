drop table if exists accounts;

create table accounts (
	id tinytext not null,
	name text not null,
	is_disabled tinyint not null default 0,
	email varchar(255) not null,
	password tinytext not null,
	"type" tinyint not null default 0,
	created timestamp not null default CURRENT_TIMESTAMP,
	lastchange timestamp not null default CURRENT_TIMESTAMP,
	token tinytext not null default '',
	"session" tinytext not null default '',
);