import couchbase from 'couchbase';

const debug = require('../../debug')('db:clients:couchbase');

export default function(server, database) {
  return new Promise(async (resolve, reject) => {
    const dbConfig = _configDatabase(server, database);

    debug('creating database client %j', dbConfig);
    let cluster = new couchbase.Cluster(dbConfig.host, dbConfig.user, dbConfig.password);
    let bucket = cluster.openBucket(dbConfig.database, function(err) {

      if (err) {
        console.log("Error cannot open bucket!");
        throw err;
      }
      let manager = cluster.manager();
      bucket.enableN1ql(dbConfig.host);
      debug('connnected');
      resolve({
        wrapQuery,
        disconnect: () => disconnect(bucket),
        listTables: () => listTables(manager),
        executeQuery: (query) => executeQuery(bucket, query),

        listViews: () => listViews(),
        listRoutines: () => listRoutines(),
        listTableColumns: (table) => listTableColumns(),
        listTableTriggers: (table) => listTableTriggers(),
        listDatabases: () => listDatabases(dbConfig.database),
        getQuerySelectTop: (table, limit) => getQuerySelectTop(),
        getTableCreateScript: (table) => getTableCreateScript(),
        getViewCreateScript: (view) => getViewCreateScript(),
        getRoutineCreateScript: (routine) => getRoutineCreateScript(),
        truncateAllTables: () => truncateAllTables(),

      });

    });

  });
}




export function disconnect(bucket) {
  bucket.disconnect();
}

export function listTables(manager) {
  return new Promise((resolve, reject) => {
    manager.listBuckets(function(err, buckets) {
      resolve(buckets.map(bucket => bucket.name));
    });
  });
}

export function listViews() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function listRoutines() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function listTableColumns() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function listTableTriggers() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function executeQuery(bucket, queryString) {
  return new Promise((resolve, reject) => {
    const N1qlQuery = couchbase.N1qlQuery;
    var query = N1qlQuery.fromString(queryString);
    bucket.query(query, function(err, res) {
      if (err) {
        console.log('query failed', err);
        return;
      }
      console.log(res);
      let ba = [parseRowQueryResult(res)];
      console.log(ba);
      resolve(ba);
    });
  });
}

export function listDatabases(bucket) {
  return new Promise((resolve, reject) => {
    resolve([bucket]);
  });
}

export function getQuerySelectTop(bucket, limit) {
  return `SELECT * FROM ${wrapQuery(bucket)} LIMIT ${limit}`;
}

export function getTableCreateScript() {
  return new Promis((resolve, reject) => {
    resolve("not implemented");
  });
}

export function getViewCreateScript() {
  return new Promise((resolve, reject) => {
    resolve("not implemented");
  });
}

export function getRoutineCreateScript() {
  return new Promise((resolve, reject) => {
    resolve("not implemented");
  });
}

export function wrapQuery(item) {
  return `"${item}"`;
}

const getSchema = async (connection) => {
  const [result] = await executeQuery(connection, `SELECT current_schema() AS schema`);
  return result.rows[0].schema;
};

export const truncateAllTables = async (connection) => {
  resolve("not implemented");
};



function _configDatabase(server, database) {
  const config = {
    host: `couchbase://${server.config.host}`,
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
  const isSelect = Array.isArray(data);
  let rows = data.map(d => d.default);
  let fields = Object.keys(data[0].default).map(key => {
    return { 'name': key}
  });
  console.log(rows);
  console.log(fields);
  return {
    isSelect,
    rows,
    fields,
    rowCount: data.length,
    affectedRows: data.length,
  };
}
