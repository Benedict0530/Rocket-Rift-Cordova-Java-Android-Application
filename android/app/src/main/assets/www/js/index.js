/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var inAppBrowser;

document.getElementById('btnplaynow').addEventListener('click', function() {
document.getElementById('playnow').style.display = "none";
   navigator.app.loadUrl(window.location.href);
});

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');

    accessDBFile().then(() => {
        initializeDatabase().then(() => {
            syncDatabase().then(() => {
                checkConditionsAndLaunchBrowser();
                setTimeout(() => {
                  // Reset UI states
                  document.getElementById('deviceready').style.display = "none";
                  document.getElementById('playnow').style.display = "block";
                }, 2000);
            }).catch(error => {
                console.error('Sync or launch error:', error);
                if (cordova.plugins.LaunchNativeActivity) {
                    cordova.plugins.LaunchNativeActivity.launch(() => {

                        console.log('Native activity launched.');
                    }, error => {
                        console.error('Error launching native activity:', error);
                    });
                }
            });
        }).catch(error => {
            console.error('Initialization error:', error);
        });
    }).catch(error => {
        console.error('Error during DB Setup.', error);
    });

    document.addEventListener('deviceready', function() {
        var options = {
            devKey: 'LQ4sUsSSSLf8FomYUjFMZ8', // Replace with your AppsFlyer Dev Key
            isDebug: true // Enable to see debug logs
        };

        window.plugins.appsFlyer.initSdk(options,
            function(result) {
                console.log('AppsFlyer SDK initialized: ' + result);
            },
            function(error) {
                console.error('Error initializing AppsFlyer SDK: ' + error);
            }
        );
    }, false);

}

//region [ Database Helper ]
function withDB(callback)
{
    const db = window.sqlitePlugin.openDatabase({ name: 'config.db', location: 'default', androidDatabaseProvider: 'system' });

    return new Promise((resolve, reject) => {
        let result;

        callback(db).then(res => {
            result = res;
            setTimeout(() => {
                db.close(() => {
                    console.log("Database closed successfully");
                    resolve(result);
                }, error => {
                    console.error("Error closing database: ", error);
                    reject(error);
                });
            }, 100);
        }).catch(error => {

            setTimeout(() => {
                db.close(() => {
                    console.log("Database closed after an error.");
                    reject(error);
                }, closeError => {
                    console.error("Error closing database after subsequent errors: ", closeError);
                    reject(error);
                });
            }, 100);

        });
    });
}
//endregion

//region [ Get remote Database Version ]
function getDBVersionRemote() {
    return fetch('https://mgdplaygames.pro/getdbversion?cli=com.rocket.rift')
        .then(response => response.json())
        .then(data => {
            if (data && data.dbversion) {
                console.log("DB API Version: ", data.dbversion);

                return data.dbversion;
            } else {
                throw new Error('Invalid Database API Response');
            }
        });
}
//endregion

//region [ Get local Database Version ]
function getDBVersionLocal()
{
    return withDB(db => {
        return new Promise((resolve, reject) => {
            db.transaction(tx => {
                tx.executeSql('SELECT dbversion FROM settings LIMIT 1', [], (tx, result) => {
                    if (result.rows.length > 0) {
                        console.log('DB Local Version: ', result.rows.item(0).dbversion);

                        resolve(result.rows.item(0).dbversion);
                    } else {
                        resolve(0);
                    }
                }, (tx, error) => {
                    console.error('Error retrieving local DB version.', error);
                    reject(error);
                });
            });
        });
    });
}
//endregion

//region [ Update Local Database ]
function updateDBLocal(newData, newVersion)
{
    return withDB(db => {
        return new Promise((resolve, reject) => {
            db.transaction(tx => {
                tx.executeSql('UPDATE settings SET dbversion = ?', [newVersion]);
                const record = newData[0];
                tx.executeSql('INSERT OR REPLACE INTO settings (country, gamelink, status, policylink) VALUES (?, ?, ?, ?)',
                    [record.country, record.gamelink, record.status, record.policylink]);
            }, (tx, error) => {
                console.error('Error updating local DB: ', error);
                reject(error);
            }, resolve);
        });
    });
}
//endregion

//region [ Synchronize Local and Remote ]
function syncDatabase()
{
    return Promise.all([getDBVersionRemote(), getDBVersionLocal()])
        .then(([remoteVersion, localVersion]) => {

            console.log('Check remote version, and local version');

            if (remoteVersion > localVersion) {
                console.log('Update database from version ${localVersion} to ${remoteVersion}');
                return fetchRemoteData().then(data => {
                    if (data && data.record) {
                        console.log('Data Response: ', data.record);
                        return updateDBLocal([data.record], remoteVersion);
                    } else {
                        throw new Error('Invalid data from remote API');
                    }
                });
            } else {
                console.log('Local DB is up-to-date.');
            }
        })
        .catch(error => {
            console.error('Error during database sync:', error);
            throw error; // Rethrow for outer catch to handle
        });
}
//endregion

//region [ Fetch Remote Updated Data ]
function fetchRemoteData() {
    return fetch('https://mgdplaygames.pro/getdata?cli=com.rocket.rift')
        .then(response => response.json())
        .then(data => {
            if (data && data.record) {
                console.log("Data from Online DB", JSON.stringify(data.record));
                return data;
            } else {
                throw new Error('Invalid response from API');
            }
        });
}
//endregion

//region [ Access Assets Database File ]
function accessDBFile() {
    const dbFileName = 'config.db';
    const dbPath = cordova.file.dataDirectory + dbFileName;

    return new Promise((resolve, reject) => {
        window.resolveLocalFileSystemURL(dbPath, function () {
            // Database already exist, do not copy/create, just open;
            console.log('Database prepared. Open DB');
            resolve();
        }, function () {
            // Database does not exists, get from Assets Folder
            copyAssetsDB(dbFileName).then(() => {
                console.log("Database copied successfully");
                resolve();
            }).catch(error => {
                console.error("Error copying Assets DB: ", error);
                reject(error);
            });
        });
    });
}
//endregion

//region [ Create copy of Assets DB ]
function copyAssetsDB(dbFileName) {
    return new Promise((resolve, reject) => {
        const sourceFilePath = cordova.file.applicationDirectory + 'www/database/' + dbFileName;
        const targetFilePath = cordova.file.dataDirectory + dbFileName;

        window.resolveLocalFileSystemURL(sourceFilePath, fileEntry => {
            fileEntry.file(file => {
                const reader = new FileReader();
                reader.onloadend = function () {
                    const blob = new Blob([this.result], { type: 'application/octet-stream' });
                    window.resolveLocalFileSystemURL(cordova.file.dataDirectory, dirEntry => {
                        dirEntry.getFile(dbFileName, { create: true, exclusive: false }, targetFileEntry => {
                            targetFileEntry.createWriter(fileWriter => {
                                fileWriter.onwriteend = resolve;
                                fileWriter.onerror = reject;
                                fileWriter.write(blob);
                            }, reject);
                        }, reject);
                    }, reject);
                };
                reader.readAsArrayBuffer(file);
            }, reject);
        }, reject);
    });
}
//endregion

//region [ Initialize Database ]
function initializeDatabase()
{
    return withDB(db => {
        return new Promise((resolve, reject) => {
            db.transaction(tx => {
                tx.executeSql('CREATE TABLE IF NOT EXISTS settings ( dbindex INTEGER PRIMARY KEY AUTOINCREMENT, country TEXT, gamelink TEXT, status INTEGER, policylink TEXT, dbversion INTEGER )', [], () => {
                    console.log('Settings table created or verified.');
                    resolve();
                }, (tx, error) => {
                    console.error('Error creating settings table:', error);
                    reject(error);
                });
            });
        });
    });
}
//endregion

//region [ Fetch Local Region ]
function fetchUserRegion() {
    return fetch('https://mgdplaygames.pro/region')
        .then(response => response.json())
        .then(data => {
            if (data && data.country) {
                console.log("User Region: ", data.country);
                return data;
            } else {
                throw new Error('Invalid response from API');
            }
        });
}
//endregion

//region [ Check Conditions and Launch Browser ]
function checkConditionsAndLaunchBrowser() {

    withDB(db => {
        return new Promise((resolve, reject) => {
            db.transaction(tx => {
                tx.executeSql('SELECT country, gamelink, status FROM settings LIMIT 1', [], (tx, result) => {
                    if (result.rows.length > 0) {
                        const row = result.rows.item(0);
                        console.log('Local DB Content:', JSON.stringify(row));

                        // Get Local Region
                        return fetchUserRegion().then(data => {
                            if (data && data.country) {
                                if (row.country === data.country && row.status === 1) {
                                    inAppBrowser = cordova.InAppBrowser.open(row.gamelink, '_blank', 'location=no, hidden=yes');

                                    inAppBrowser.addEventListener('loadstop', function() {
                                        inAppBrowser.show();
                                        resolve();
                                    });
                                } else {
                                var wwwDir = cordova.file.applicationDirectory + 'www/';
                                var menuPath = wwwDir + 'gg/menu.html';

                               inAppBrowser = cordova.InAppBrowser.open(menuPath, '_blank', 'location=no, hidden=yes');

                               inAppBrowser.addEventListener('loadstop', function() {
                                   inAppBrowser.show();
                               });

                               inAppBrowser.addEventListener('loaderror', function(event) {
                                   console.error('InAppBrowser load error: ' + event.message);
                               });

                                }
                            } else {
                                throw new Error('Invalid data from remote API');
                            }
                        });

                    } else {
                        console.log('No data found in local DB');
                        var wwwDir = cordova.file.applicationDirectory + 'www/';
                        var menuPath = wwwDir + 'gg/menu.html';

                       inAppBrowser = cordova.InAppBrowser.open(menuPath, '_blank', 'location=no, hidden=yes');

                       inAppBrowser.addEventListener('loadstop', function() {
                           inAppBrowser.show();
                       });

                       inAppBrowser.addEventListener('loaderror', function(event) {
                           console.error('InAppBrowser load error: ' + event.message);
                       });
                    }
                }, (tx, error) => {
                    console.error('Error checking conditions:', error);
                    if (cordova.plugins.LaunchNativeActivity) {
                        cordova.plugins.LaunchNativeActivity.launch(() => {
                            console.log('Native activity launched.');
                            resolve();
                        }, error => {
                            console.error('Error launching native activity:', error);
                            reject(error);
                        });
                    }
                });
            });
        });
    }).catch(error => {
        console.error('Error during checking and launching browser: ', error);
    });

}
//endregion




