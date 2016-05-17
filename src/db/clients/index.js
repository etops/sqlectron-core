import mysql from './mysql';
import postgresql from './postgresql';
import sqlserver from './sqlserver';
import couchbase from './couchbase';

/**
 * List of supported database clients
 */
export const CLIENTS = [
  {
    key: 'mysql',
    name: 'MySQL',
    defaultPort: 3306,
  },
  {
    key: 'postgresql',
    name: 'PostgreSQL',
    defaultDatabase: 'postgres',
    defaultPort: 5432,
  },
  {
    key: 'sqlserver',
    name: 'Microsoft SQL Server',
    defaultPort: 1433,
  },
  {
    key: 'couchbase',
    name: 'Couchbase',
    defaultDatabase: 'default',
    defaultPort: 8091,
  }
];


export default {
  mysql,
  postgresql,
  sqlserver,
  couchbase,
};
