import {Connection} from 'mssql';


const debug = require('../../debug')('db:clients:sqlserver');


export default async function(server, database) {
  let connection;
  try {
    const dbConfig = _configDatabase(server, database);

    debug('creating database connection %j', dbConfig);
    connection = new Connection(dbConfig);

    debug('connecting');
    await connection.connect();

    debug('connected');
    return {
      disconnect: () => disconnect(connection),
      listTables: () => listTables(connection),
      executeQuery: (query) => executeQuery(connection, query),
      listDatabases: () => listDatabases(connection),
      getQuerySelectTop: (table, limit) => getQuerySelectTop(connection, table, limit),
      truncateAllTables: () => truncateAllTables(connection),
    };
  } catch (err) {
    if (connection) {
      connection.close();
    }
    throw err;
  }
}


export const disconnect = (connection) => connection.close();
export const wrapQuery = (item) => `[${item}]`;
export const getQuerySelectTop = (client, table, limit) => `SELECT TOP ${limit} * FROM ${wrapQuery(table)}`;


export const executeQuery = async (connection, query) => {
  const request = connection.request();
  request.multiple = true;

  const recordSet = await request.query(query);

  // Executing only non select queries will not return results.
  // So we "fake" there is at least one result.
  const results = !recordSet.length && request.rowsAffected ? [[]] : recordSet;

  return results.map((_, idx) => parseRowQueryResult(results[idx], request));
};


const getSchema = async (connection) => {
  const [result] = await executeQuery(connection, `SELECT schema_name() AS 'schema'`);
  return result.rows[0].schema;
};


export const listTables = async (connection) => {
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    ORDER BY table_name
  `;
  const [result] = await executeQuery(connection, sql);
  return result.rows.map(row => row.table_name);
};


export const listDatabases = async (connection) => {
  const [result] = await executeQuery(connection, 'SELECT name FROM sys.databases');
  return result.rows.map(row => row.name);
};


export const truncateAllTables = async (connection) => {
  const schema = await getSchema(connection);
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}'
  `;
  const [result] = await executeQuery(connection, sql);
  const tables = result.rows.map(row => row.table_name);
  const promises = tables.map(t => executeQuery(connection, `
    TRUNCATE TABLE ${wrapQuery(schema)}.${wrapQuery(t)}
  `));

  await Promise.all(promises);
};


function _configDatabase(server, database) {
  const config = {
    user: server.config.user,
    password: server.config.password,
    server: server.config.host,
    database: database.database,
    port: server.config.port,
    options: {
      encrypt: server.config.ssl,
    },
  };

  if (server.sshTunnel) {
    config.server = server.config.localHost;
    config.port = server.config.localPort;
  }

  return config;
}


function parseRowQueryResult(data, request) {
  // TODO: find a better way without hacks to detect if it is a select query
  // This current approach will not work properly in some cases
  const isSelect = !!(data.length || !request.rowsAffected);

  return {
    isSelect,
    rows: data,
    fields: Object.keys(data[0] || {}).map(name => ({ name })),
    rowCount: data.length,
    affectedRows: request.rowsAffected,
  };
}
