import couchbase from 'couchbase';

export default function(server, cluster) {
  return new Promise(async (resolve, reject) => {
    const dbConfig = _configDatabase(server, cluster);

    debug('creating database client %j', dbConfig);

    let cluster = new couchbase.Cluster(dbConfig.host);
    let bucket = cluster.openBucket(dbConfig.database, function(err) {
    let bucketManager = bucket.manager;
    });
    bucket.enableN1ql(dbConfig.host);

    debug('connnected');
    resolve({
      wrapQuery,
      disconnect: () => disconnect(bucket),
      listTables: () => listTables(cluster.manager),
      executeQuery: () => executeQuery(bucket),

    });

    //TODO
  });
}




export function disconnect(bucket) {
  bucket.disconnect();
}

export function listTables(manager) {
  return new Promise((resolve, reject) => {
    manager.listBuckets(function(buckets) {
      resolve(buckets);
    });
  });
}

/*export function listView(cluster) {
  return new Promise((resolve, reject) => {
    const sql =
    //TODO
  });
}*/

/*export function listRoutines(cluster) {
  return new Promise((resolve, reject) => {
    reject("couchbase has no routines!");
  });
}*/

/*export function listTableColumns(cluster, table) {
  return new Promise((resolve, reject) => {
    const sql =
    //TODO
  });
}*/

/*export function listTableTriggers(cluster, table) {
  return new Promise((resolve, reject) => {
    reject("couchbase has no table triggers");
  });
}*/

export function executeQuery(bucket, queryString) {
  return new Promise((resolve, reject) => {
    const N1qlQuery = couchbase;
    var query = N1qlQuery.fromString(queryString);
    bucket.query(query, function(err, res) {
      if (err) {
        console.log('query failed', err);
        return;
      }
      resolve(parseRowQueryResult(res));
    });
  });
}

/*export function listDatabases(manager) {
  return new Promise((resolve, reject) => {

  });
}*/

export function getQuerySelectTop(bucket, limit) {
  return `SELECT * FROM ${wrapQuery(bucket)} LIMIT ${limit}`;
}

/*export function getTableCreateScript(cluster, bucket) {
  return new Promis((resolve, reject) => {
    //TODO:
  });
}*/

/*export function getViewCreateScript(cluster, view) {
  return new Promise((resolve, reject) => {
    //TODO;
  });
}*/

/*export function getRoutineCreateScript(cluster, routine) {
  return new Promise((resolve, reject) => {
    //TODO
  });
}*/

export function wrapQuery(item) {
  return `"${item}"`;
}

/*const getSchema = async (connection) => {
  const [result] = await executeQuery(connection, `SELECT current_schema() AS schema`);
  return result.rows[0].schema;
};*/

/*export const truncateAllTables = async (connection) => {
  const schema = await getSchema(connection);
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}'
    AND table_type NOT LIKE '%VIEW%'
  `;
  const [result] = await executeQuery(connection, sql);
  const tables = result.rows.map(row => row.table_name);
  const promises = tables.map(t => {
    const truncateSQL = `
      TRUNCATE TABLE ${wrapQuery(schema)}.${wrapQuery(t)}
      RESTART IDENTITY CASCADE;
    `;
    return executeQuery(connection, truncateSQL);
  });

  await Promise.all(promises);
};*/



function _configDatabase(server, database) {
  const config = {
    host: server.config.host,
    port: server.config.port,
    user: server.config.user,
    password: server.config.password,
    database: database.database,
  };

  if (server.sshTunnel) {
    config.host = server.config.localHost;
    config.port = server.config.localPort;
  }

  if (server.config.ssl) {
    config.ssl = server.config.ssl;
  }

  return config;
}


function parseRowQueryResult(data) {
  const isSelect = data.command === 'SELECT';
  return {
    isSelect,
    rows: data.rows,
    fields: data.fields,
    rowCount: isSelect ? data.rowCount : undefined,
    affectedRows: !isSelect ? data.rowCount : undefined,
  };
}
