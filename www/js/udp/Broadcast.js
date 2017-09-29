/*
  @device object from plugin: cordova-plugin-device
  @projectCount we should tell someone else the count of my projects
  @ip wifi internal ip in LAN from plugin: cordova-plugin-networkinterface
*/
function Broadcast (device, projectCount, ip) {
  this.device = device; // device info for broadcast
  this.projectCount = projectCount; // project count for broadcast
  this.ip = ip; // ip for broadcast

  /* eg:
    [
      { socketId: '1',
        address: '192.168.0.1',
        port: 20017,
        profile: { device: $device, projectCount: 18, ip: '192.168.0.100'},
        firstFindTimestamp: 14323213131,
        lastFindTimestamp: 14323312313
      },
      { socketId: '2',
        address: '192.168.0.2',
        port: 20017,
        profile: { device: $device, projectCount: 1, ip: '192.168.0.101'},
        firstFindTimestamp: 12313131,
        lastFindTimestamp: 2131313
      },
      { socketId: '3',
        address: '192.168.0.3',
        port: 20017,
        profile: { device: $device, projectCount: 0, ip: '192.168.0.102'},
        firstFindTimestamp: 12131313,
        lastFindTimestamp: 1231313
      }
    ]
  */
  this.onlineList = []; // save current online list for other ides

  this.broadcastTaskId = null;
  this.broadcastCreateInfo = null;
  this.recvListener = null;
  this.recvErrorListener = null;

  this.onOnlineListChangedListener = null; // @see registerOnlineListChangedListener / unregisterOnlineListChangedListener
};

Broadcast.prototype.start = function () {
  var that = this;
  this.bindBroadcast(function () {
    that.bindRecvListener();
    that.startBroadcast();
  });
};

Broadcast.prototype.stop = function () {
  this.unbindRecvListener();
  this.stopBroadcast();
  this.unbindBroadcast();
};

Broadcast.BROADCAST_INTERVAL = 1000; // 1s
Broadcast.PORT = 20017; // broadcast port
Broadcast.IP = '255.255.255.255';
Broadcast.OFFLINE_TIME = 5 * 1000;// 5s offline

Broadcast.prototype.bindBroadcast = function (cb) {
  this.unbindBroadcast();// if needed
  var that = this;

  chrome.sockets.udp.create(function (createInfo) {
    chrome.sockets.udp.bind(createInfo.socketId, '0.0.0.0', Broadcast.PORT, function (result) {
      if (result < 0) throw new Error('bindBroadcast#bind error: code=' + result);
      chrome.sockets.udp.setBroadcast(createInfo.socketId, true, function (result) {
        if (result < 0) { // failed
          throw new Error('bindBroadcast#setBroadcast error: code=' + result);
        } else { // success
          that.broadcastCreateInfo = createInfo;
          if (typeof cb === 'function') cb();
        }
      });
    });
  });
};

Broadcast.prototype.unbindBroadcast = function () {
  if (this.broadcastCreateInfo) {
    chrome.sockets.udp.close(this.broadcastCreateInfo.socketId);
    this.broadcastCreateInfo = null;
  }
};

Broadcast.prototype.startBroadcast = function () {
  this.stopBroadcast(); // if needed
  var that = this;
  var data = {
    device: this.device,
    projectCount: this.projectCount,
    ip: this.ip
  };
  data = JSON.stringify(data);
  data = stringToBytes(data);
  var task = function () {
    if (that.broadcastCreateInfo) {
      chrome.sockets.udp.send(that.broadcastCreateInfo.socketId, data, Broadcast.IP, Broadcast.PORT, function (result) {
        if (result < 0) {
          console.error('send error: ' + result);
        } else {
          // ignore it
        }
      });
    }

    // check if any devices is offline
    for (var i = 0; i < that.onlineList.length; i++) {
      var now = new Date().getTime();
      var delta = now - that.onlineList[i].lastFindTimestamp;
      if (delta > Broadcast.OFFLINE_TIME) {
        if (that.onOnlineListChangedListener) that.onOnlineListChangedListener.offline(that.onlineList[i]);

        that.onlineList.splice(i, 1);
        i--;
      }
    }

  };
  this.broadcastTaskId = setInterval(task, Broadcast.BROADCAST_INTERVAL);
  task();
};

Broadcast.prototype.stopBroadcast = function () {
  if (this.broadcastTaskId) {
    clearInterval(this.broadcastTaskId);
    this.broadcastTaskId = null;
  }
  this.onlineList = []; // clear all the online list
};

Broadcast.prototype.bindRecvListener = function () {
  var that = this;
  this.unbindRecvListener(); // if needed
  this.recvListener = function (info) {
    if (that.broadcastCreateInfo.socketId !== info.socketId) return;
    // var socketId = info.socketId;
    // var data = info.data;
    // var remoteAddress = info.remoteAddress;
    // var remotePort = info.remotePort;

    that.__handleNewDevice(info);
  };
  this.recvErrorListener = function (info) {
    if (that.broadcastCreateInfo.socketId !== info.socketId) return;
    var socketId = info.socketId;
    var resultCode = info.resultCode;
    console.error('recv error: socketId=' + socketId + ' resultCode=' + resultCode);
  };
  chrome.sockets.udp.onReceive.addListener(this.recvListener);
  chrome.sockets.udp.onReceiveError.addListener(this.recvErrorListener);
};

Broadcast.prototype.unbindRecvListener = function () {
  if (this.recvListener) {
    chrome.sockets.udp.onReceive.removeListener(this.recvListener);
    this.recvListener = null;
  }
  if (this.recvErrorListener) {
    chrome.sockets.udp.onReceiveError.removeListener(this.recvErrorListener);
    this.recvErrorListener = null;
  }
};

Broadcast.prototype.__handleNewDevice = function (info) {
  var socketId = info.socketId;
  var data = info.data;
  var remoteAddress = info.remoteAddress;
  var remotePort = info.remotePort;

  // only care about the broadcast port info
  if (remotePort !== Broadcast.PORT) return;

  // IPv4: ::ffff:192.168.0.67
  if (remoteAddress.startsWith('::ffff:')) remoteAddress = remoteAddress.substring(7, remoteAddress.length);

  var isExist = false;
  for (var i = 0; i < this.onlineList.length; i++) {
    if (remoteAddress && this.onlineList[i].address == remoteAddress) {
      isExist = true;
      // update the timestamp
      this.onlineList[i].lastFindTimestamp = new Date().getTime();
      break;
    }
  }

  if (!isExist) {
    if (remoteAddress == this.ip) { // self should be ignored
      return;
    }
    var onlineItem = {
      socketId: socketId,
      address: remoteAddress,
      remotePort: remotePort,
      profile: JSON.parse(bytesToString(data)),
      firstFindTimestamp: new Date().getTime(),
      lastFindTimestamp: new Date().getTime()
    };
    this.onlineList.push(onlineItem);

    if (this.onOnlineListChangedListener) this.onOnlineListChangedListener.online(onlineItem);
  }
};

// listener: { online: function (device) { ... }, offline: function (device) { ... } }
Broadcast.prototype.registerOnlineListChangedListener = function (listener) {
  this.onOnlineListChangedListener = listener;
};

Broadcast.prototype.unregisterOnlineListChangedListener = function () {
  this.onOnlineListChangedListener = null;
};
