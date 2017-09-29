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
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);


        networkinterface.getWiFiIPAddress(
          function (ip, subnet) {
            console.log('ip get: ' + ip + ' ' + subnet);
            var b = new Broadcast(device, 9, ip);
            b.registerOnlineListChangedListener({
              online: function (d) {
                console.log('Find new device: ' + JSON.stringify(d));

                var t = new Transfer(d, [
                  {
                    name: 'Untitle 0',
                    description: 'abc',
                    photos: [],
                    data: '<xml><\/xml>',
                    create_time: 1234,
                    update_time: 1234,
                    uuid: 'abccada-saadad'
                  },
                  {
                    name: 'Untitle 1',
                    description: 'bcd',
                    photos: [],
                    data: '<xml><\/xml>',
                    create_time: 2345,
                    update_time: 2345,
                    uuid: 'abccada-saadad'
                  },
                  {
                    name: 'Untitle 2',
                    description: 'cde',
                    photos: [],
                    data: '<xml><\/xml>',
                    create_time: 3456,
                    update_time: 3456,
                    uuid: 'abccada-saadad'
                  },
                  {
                    name: '未命名 3', // do not support
                    description: '描述信息', // do not support
                    photos: [],
                    data: '<xml><\/xml>',
                    create_time: 3456,
                    update_time: 3456,
                    uuid: 'abccada-saadad'
                  }
                ]);

                t.registerTransferListener({
                  onSendFailed: function () {},
                  onSendSuccess: function () {
                    console.log('onSendSuccess');
                  },
                  onSendProgressUpdate: function (p) {
                    console.log('onSendProgressUpdate: ' + p + '%');
                  },

                  onReceiveFailed: function () {},
                  onReceiveSuccess: function (arr) {
                    console.log('onReceiveSuccess: ' + JSON.stringify(arr));
                  },
                  onReceiveProgressUpdate: function (p) {
                    console.log('onReceiveProgressUpdate: ' + p + '%');
                  }
                });

                if (ip === '192.168.0.67') t.startSend();
                else t.startRecv();
              },
              offline: function (d) {
                console.log('Device offiline: ' + JSON.stringify(d));
              }
            });
            b.start();
          },
          function (err) { alert(err); });
    }
};

app.initialize();
