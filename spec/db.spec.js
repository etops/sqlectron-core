import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { db } from '../src';
import config from './databases/config';
chai.use(chaiAsPromised);

/**
 * List of supported DB clients.
 * The "integration" tests will be executed for all supported DB clients.
 * And ensure all these clients has the same API and output results.
 */
const SUPPORTED_DB_CLIENTS = ['mysql', 'postgresql', 'sqlserver'];


/**
 * List of selected databases to be tested in the current task
 */
const dbsToTest = (process.env.DB_CLIENTS || '').split(',').filter(client => !!client);


describe('db', () => {
  const dbClients = dbsToTest.length ? dbsToTest : SUPPORTED_DB_CLIENTS;
  if (dbClients.some(dbClient => !~SUPPORTED_DB_CLIENTS.indexOf(dbClient))) {
    throw new Error('Invalid selected db client for tests');
  }

  dbClients.map(dbClient => {
    describe(dbClient, () => {
      describe('.connect', () => {
        it(`should connect into a ${dbClient} database`, () => {
          const serverInfo = {
            ...config[dbClient],
            name: dbClient,
            client: dbClient,
          };

          const serverSession = db.createServer(serverInfo);
          const dbConn = serverSession.createConnection(serverInfo.database);

          return expect(dbConn.connect()).to.not.be.rejected;
        });
      });

      describe('given is already connected', () => {
        const serverInfo = {
          ...config[dbClient],
          name: dbClient,
          client: dbClient,
        };

        let serverSession;
        let dbConn;
        beforeEach(() => {
          serverSession = db.createServer(serverInfo);
          dbConn = serverSession.createConnection(serverInfo.database);
          return dbConn.connect();
        });

        describe('.listDatabases', () => {
          it('should list all databases', async () => {
            const databases = await dbConn.listDatabases();
            expect(databases).to.include.members(['sqlectron']);
          });
        });

        describe('.listTables', () => {
          it('should list all tables', async () => {
            const tables = await dbConn.listTables();
            expect(tables).to.include.members(['users', 'roles']);
          });
        });

        describe('.executeQuery', () => {
          beforeEach(() => Promise.all([
            dbConn.executeQuery(`
              INSERT INTO users (username, email, password)
              VALUES ('maxcnunes', 'maxcnunes@gmail.com', '123456')
            `),
            dbConn.executeQuery(`
              INSERT INTO roles (name)
              VALUES ('developer')
            `),
          ]));

          afterEach(() => dbConn.truncateAllTables());

          describe('SELECT', () => {
            it('should execute a single query with empty result', async () => {
              const results = await dbConn.executeQuery(`select * from users where id < 0`);

              expect(results).to.have.length(1);
              const [result] = results;

              // MSSQL does not return the fields when the result is empty.
              // For those DBs that return the field names even when the result
              // is empty we should ensure all fields are included.
              if (dbClient === 'sqlserver') {
                expect(result).to.have.property('fields').to.eql([]);
              } else {
                expect(result).to.have.deep.property('fields[0].name').to.eql('id');
                expect(result).to.have.deep.property('fields[1].name').to.eql('username');
                expect(result).to.have.deep.property('fields[2].name').to.eql('email');
                expect(result).to.have.deep.property('fields[3].name').to.eql('password');
              }

              expect(result).to.have.property('isSelect').to.eql(true);
              expect(result).to.have.property('rows').to.eql([]);
              expect(result).to.have.deep.property('rowCount').to.eql(0);
            });

            it('should execute a single query', async () => {
              const results = await dbConn.executeQuery(`select * from users`);

              expect(results).to.have.length(1);
              const [result] = results;

              expect(result).to.have.deep.property('fields[0].name').to.eql('id');
              expect(result).to.have.deep.property('fields[1].name').to.eql('username');
              expect(result).to.have.deep.property('fields[2].name').to.eql('email');
              expect(result).to.have.deep.property('fields[3].name').to.eql('password');

              expect(result).to.have.deep.property('rows[0].id').to.eql(1);
              expect(result).to.have.deep.property('rows[0].username').to.eql('maxcnunes');
              expect(result).to.have.deep.property('rows[0].password').to.eql('123456');
              expect(result).to.have.deep.property('rows[0].email').to.eql('maxcnunes@gmail.com');

              expect(result).to.have.property('isSelect').to.eql(true);
              expect(result).to.have.deep.property('rowCount').to.eql(1);
            });

            it('should execute multiple queries', async () => {
              const results = await dbConn.executeQuery(`
                select * from users;
                select * from roles;
              `);

              expect(results).to.have.length(2);
              const [firstResult, secondResult] = results;

              expect(firstResult).to.have.deep.property('fields[0].name').to.eql('id');
              expect(firstResult).to.have.deep.property('fields[1].name').to.eql('username');
              expect(firstResult).to.have.deep.property('fields[2].name').to.eql('email');
              expect(firstResult).to.have.deep.property('fields[3].name').to.eql('password');

              expect(firstResult).to.have.deep.property('rows[0].id').to.eql(1);
              expect(firstResult).to.have.deep.property('rows[0].username').to.eql('maxcnunes');
              expect(firstResult).to.have.deep.property('rows[0].password').to.eql('123456');
              expect(firstResult).to.have.deep.property('rows[0].email').to.eql('maxcnunes@gmail.com');

              expect(firstResult).to.have.property('isSelect').to.eql(true);
              expect(firstResult).to.have.deep.property('rowCount').to.eql(1);

              expect(secondResult).to.have.deep.property('fields[0].name').to.eql('id');
              expect(secondResult).to.have.deep.property('fields[1].name').to.eql('name');

              expect(secondResult).to.have.deep.property('rows[0].id').to.eql(1);
              expect(secondResult).to.have.deep.property('rows[0].name').to.eql('developer');

              expect(secondResult).to.have.property('isSelect').to.eql(true);
              expect(secondResult).to.have.deep.property('rowCount').to.eql(1);
            });
          });

          describe('INSERT', () => {
            it('should execute a single query', async () => {
              const results = await dbConn.executeQuery(`
                insert into users (username, email, password)
                values ('user', 'user@hotmail.com', '123456')
              `);

              expect(results).to.have.length(1);
              const [result] = results;

              expect(result).to.have.property('rows').to.eql([]);
              expect(result).to.have.property('fields').to.eql([]);
              expect(result).to.have.property('affectedRows').to.eql(1);
              expect(result).to.have.property('isSelect').to.eql(false);

              // MSSQL does not return row count
              // so these value is based in the number of rows
              if (dbClient === 'sqlserver') {
                expect(result).to.have.property('rowCount').to.eql(0);
              } else {
                expect(result).to.have.property('rowCount').to.eql(undefined);
              }
            });

            it('should execute multiple queries', async () => {
              const results = await dbConn.executeQuery(`
                insert into users (username, email, password)
                values ('user', 'user@hotmail.com', '123456');

                insert into roles (name)
                values ('manager');
              `);

              // MSSQL treats multiple non select queries as a single query result
              if (dbClient === 'sqlserver') {
                expect(results).to.have.length(1);
                const [result] = results;

                expect(result).to.have.property('rows').to.eql([]);
                expect(result).to.have.property('fields').to.eql([]);
                expect(result).to.have.property('isSelect').to.eql(false);
                expect(result).to.have.property('rowCount').to.eql(0);
                expect(result).to.have.property('affectedRows').to.eql(2);
              } else {
                expect(results).to.have.length(2);
                const [firstResult, secondResult] = results;

                expect(firstResult).to.have.property('rows').to.eql([]);
                expect(firstResult).to.have.property('fields').to.eql([]);
                expect(firstResult).to.have.property('isSelect').to.eql(false);
                expect(firstResult).to.have.property('rowCount').to.eql(undefined);
                expect(firstResult).to.have.property('affectedRows').to.eql(1);

                expect(secondResult).to.have.property('rows').to.eql([]);
                expect(secondResult).to.have.property('fields').to.eql([]);
                expect(secondResult).to.have.property('isSelect').to.eql(false);
                expect(secondResult).to.have.property('rowCount').to.eql(undefined);
                expect(secondResult).to.have.property('affectedRows').to.eql(1);
              }
            });
          });

          describe('DELETE', () => {
            it('should execute a single query', async () => {
              const results = await dbConn.executeQuery(`
                delete from users where username = 'maxcnunes'
              `);

              expect(results).to.have.length(1);
              const [result] = results;

              expect(result).to.have.property('rows').to.eql([]);
              expect(result).to.have.property('fields').to.eql([]);
              expect(result).to.have.property('affectedRows').to.eql(1);
              expect(result).to.have.property('isSelect').to.eql(false);

              // MSSQL does not return row count
              // so these value is based in the number of rows
              if (dbClient === 'sqlserver') {
                expect(result).to.have.property('rowCount').to.eql(0);
              } else {
                expect(result).to.have.property('rowCount').to.eql(undefined);
              }
            });

            it('should execute multiple queries', async () => {
              const results = await dbConn.executeQuery(`
                delete from users where username = 'maxcnunes';
                delete from roles where name = 'developer';
              `);

              // MSSQL treats multiple non select queries as a single query result
              if (dbClient === 'sqlserver') {
                expect(results).to.have.length(1);
                const [result] = results;

                expect(result).to.have.property('rows').to.eql([]);
                expect(result).to.have.property('fields').to.eql([]);
                expect(result).to.have.property('isSelect').to.eql(false);
                expect(result).to.have.property('rowCount').to.eql(0);
                expect(result).to.have.property('affectedRows').to.eql(2);
              } else {
                expect(results).to.have.length(2);
                const [firstResult, secondResult] = results;

                expect(firstResult).to.have.property('rows').to.eql([]);
                expect(firstResult).to.have.property('fields').to.eql([]);
                expect(firstResult).to.have.property('isSelect').to.eql(false);
                expect(firstResult).to.have.property('rowCount').to.eql(undefined);
                expect(firstResult).to.have.property('affectedRows').to.eql(1);

                expect(secondResult).to.have.property('rows').to.eql([]);
                expect(secondResult).to.have.property('fields').to.eql([]);
                expect(secondResult).to.have.property('isSelect').to.eql(false);
                expect(secondResult).to.have.property('rowCount').to.eql(undefined);
                expect(secondResult).to.have.property('affectedRows').to.eql(1);
              }
            });
          });

          describe('UPDATE', () => {
            it('should execute a single query', async () => {
              const results = await dbConn.executeQuery(`
                update users set username = 'max' where username = 'maxcnunes'
              `);

              expect(results).to.have.length(1);
              const [result] = results;

              expect(result).to.have.property('rows').to.eql([]);
              expect(result).to.have.property('fields').to.eql([]);
              expect(result).to.have.property('affectedRows').to.eql(1);
              expect(result).to.have.property('isSelect').to.eql(false);

              // MSSQL does not return row count
              // so these value is based in the number of rows
              if (dbClient === 'sqlserver') {
                expect(result).to.have.property('rowCount').to.eql(0);
              } else {
                expect(result).to.have.property('rowCount').to.eql(undefined);
              }
            });

            it('should execute multiple queries', async () => {
              const results = await dbConn.executeQuery(`
                update users set username = 'max' where username = 'maxcnunes';
                update roles set name = 'dev' where name = 'developer';
              `);

              // MSSQL treats multiple non select queries as a single query result
              if (dbClient === 'sqlserver') {
                expect(results).to.have.length(1);
                const [result] = results;

                expect(result).to.have.property('rows').to.eql([]);
                expect(result).to.have.property('fields').to.eql([]);
                expect(result).to.have.property('isSelect').to.eql(false);
                expect(result).to.have.property('rowCount').to.eql(0);
                expect(result).to.have.property('affectedRows').to.eql(2);
              } else {
                expect(results).to.have.length(2);
                const [firstResult, secondResult] = results;

                expect(firstResult).to.have.property('rows').to.eql([]);
                expect(firstResult).to.have.property('fields').to.eql([]);
                expect(firstResult).to.have.property('isSelect').to.eql(false);
                expect(firstResult).to.have.property('rowCount').to.eql(undefined);
                expect(firstResult).to.have.property('affectedRows').to.eql(1);

                expect(secondResult).to.have.property('rows').to.eql([]);
                expect(secondResult).to.have.property('fields').to.eql([]);
                expect(secondResult).to.have.property('isSelect').to.eql(false);
                expect(secondResult).to.have.property('rowCount').to.eql(undefined);
                expect(secondResult).to.have.property('affectedRows').to.eql(1);
              }
            });
          });
        });
      });
    });
  });
});
