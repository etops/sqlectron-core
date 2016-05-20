import couchbase from 'couchbase';
const N1qlQuery = couchbase.N1qlQuery;
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
      let bucketManager = bucket.manager();
      bucket.enableN1ql(dbConfig.host);
      debug('connnected');
      resolve({
        wrapQuery,
        disconnect: () => disconnect(bucket),
        listTables: () => listTables(bucket, dbConfig.database),
        executeQuery: (query) => executeQuery(bucket, query, dbConfig.database),

        listViews: () => listViews(bucketManager),
        listRoutines: () => listRoutines(),
        listTableColumns: (table) => listTableColumns(bucket, table, dbConfig.database),
        listTableTriggers: (table) => listTableTriggers(),
        listDatabases: () => listDatabases(manager),
        getQuerySelectTop: (table, limit) => getQuerySelectTop(dbConfig.database, table, limit),
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

export function listTables(bucket, bucketName) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT _type
      FROM ${bucketName}
      GROUP BY _type
    `;
    try {
      var query = N1qlQuery.fromString(sql);
      bucket.query(query, function(err, res) {
        if (err) {
          reject(err);
        }
        //console.log(res);
        //console.log(res.map(row => row._type));
        resolve(res.map(row => row._type).sort());
      });
    } catch(err) {
      reject(err);
    }
  });
}

export function listViews(bucketManager) {
  return new Promise((resolve, reject) => {
    //var docs = bucketManager.getDesignDocuments();
    // get design documents and for each design documents all the views
    // console.log(docs);
    resolve([]);
  });
}

export function listRoutines() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function listTableColumns(bucket, table, bucketName) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT *
      FROM ${bucketName}
      WHERE _type="${table}"
      LIMIT 1
    `;
    try {
      var query = N1qlQuery.fromString(sql);
      bucket.query(query, function(err, res) {
        if (err) {
          reject(err);
        }
        resolve(Object.keys(res[0][bucketName]).map(key => ({ columnName: key, dataType: typeof res[0][bucketName][key]})));
      });
    } catch(err) {
      reject(err);
    }
  });
}

export function listTableTriggers() {
  return new Promise((resolve, reject) => {
    resolve([]);
  });
}

export function executeQuery(bucket, queryString, bucketName) {
  let name = getFrom(queryString, bucketName);
  return new Promise((resolve, reject) => {
    try {
      var query = N1qlQuery.fromString(queryString);
      bucket.query(query, function(err, res) {
        if (err) {
          reject(err);
        }

        resolve([parseRowQueryResult(res, name)]);
      });
    } catch(err) {
      reject(err);
    }
  });
}

export function listDatabases(manager) {
  return new Promise((resolve, reject) => {
    manager.listBuckets(function(err, buckets) {
      resolve(buckets.map(bucket => bucket.name));
    });
    //resolve([bucket]);
  });
}

export function getQuerySelectTop(bucketName, table, limit) {
  return `SELECT * FROM ${bucketName} WHERE _type="${table}" LIMIT ${limit}`;
}

export function getTableCreateScript() {
  return new Promis((resolve, reject) => {
    resolve("Not implemented!");
  });
}

export function getViewCreateScript() {
  return new Promise((resolve, reject) => {
    resolve("Not implemented!");
  });
}

export function getRoutineCreateScript() {
  return new Promise((resolve, reject) => {
    resolve("Not implemented!");
  });
}

export function wrapQuery(item) {
  return `${item}`;
}

const getSchema = async (connection) => {
  const [result] = await executeQuery(connection, `SELECT current_schema() AS schema`);
  return result.rows[0].schema;
};

export const truncateAllTables = async (connection) => {
  resolve("Not implemented!");
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

function parseRowQueryResult(data, name) {
  const isSelect = Array.isArray(data);
  let rows = [];
  let fields = [];
  if(data.length > 0) {
    rows = data.map(d => d[name] || d);
    fields = Object.keys(data[0][name] || data[0]).map(key => ({ 'name': key}));
  }

  return {
    isSelect,
    rows,
    fields,
    rowCount: data.length,
    affectedRows: data.length,
  };
}

function getFrom(query, bucketName) {
  const fromStr = query.match(/from [a-z,.]*/gi);
  if(fromStr.length > 0) {
    const idx = fromStr[0].lastIndexOf('.');
    const name = fromStr[0].substring(idx !== -1 ? idx+1 : 5);
    return name;
  } else {
    return bucketName;
  }
}
