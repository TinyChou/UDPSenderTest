/*
  @device object from Broadcast.js (online device)
  @data [Project JSON Object]:  do not care about the size, we will splice it if needed
*/
function Transfer (device, data) {
  this.device = device;
  this.data = stringToBytes(JSON.stringify(data));

  this.socketCreateInfo = null;

  // send
  this.sending = false;
  this.sentChunk = 0;
  this.bytesLength = this.data.byteLength;
  this.chunkCount = parseInt(this.bytesLength / Transfer.CHUNK_SIZE) +
    ((this.bytesLength % Transfer.CHUNK_SIZE) === 0 ? 0 : 1);
  this.sent = false;
  this.isStopped = false;
  console.log('bytesLength: ' + this.bytesLength + ' chunkCount: ' + this.chunkCount + ' chunkSize: ' + Transfer.CHUNK_SIZE);

  // receive
  this.recvListener = null;
  this.receiveErrorListener = null;
};

Transfer.prototype.startSend = function () {
  var that = this;
  this.bindSocket(function () {
    that.bindRecvListener();
    that.send();
  });
};

Transfer.prototype.startRecv = function () {
  var that = this;
  this.bindSocket(function () {
    that.bindRecvListener();
    // no sending
  });
};

Transfer.prototype.stop = function () {
  if (this.sending) {
    this.stopSend();
  }
  this.unbindRecvListener();
  this.unbindSocket();
};

Transfer.CHUNK_SIZE = 2 * 1024; // 2k data packet
Transfer.PORT = 20018;
Transfer.FRAME_START = {
  op: 'START',
  chunkCount: 1234,
  bytesLength: 1024 * 8
};
Transfer.FRAME_DATA = {
  op: 'DATA',
  chunkIndex: 1, // for check the chunk order when merge all the chunks
  bytesLength: 1024, // for check the current chunk data
  data: []
};
Transfer.FRAME_END = {
  op: 'END',
  chunkCount: 1234,
  bytesLength: 1024 * 8
};

Transfer.prototype.bindSocket = function (cb) {
  var that = this;

  chrome.sockets.udp.create(function (createInfo) {
    chrome.sockets.udp.bind(createInfo.socketId, '0.0.0.0', Transfer.PORT, function (result) {
      if (result < 0) {
        throw new Error('bindSocket#bind error: ' + JSON.stringify(result));
      } else {
        that.socketCreateInfo = createInfo;
        if (typeof cb === 'function') cb();
      }
    });
  });
};

Transfer.prototype.unbindSocket = function () {
  if (this.socketCreateInfo) {
    chrome.sockets.udp.close(this.socketCreateInfo.socketId);
    this.socketCreateInfo = null;
  }
};

Transfer.prototype.send = function () {
  var that = this;
  var data = null;

  if (this.isStopped) {
    this.sending = false;
    this.sentChunk = 0;
    this.sent = false;
    return;
  }

  if (this.sending) { // seding hava been started
    if (this.sentChunk === this.chunkCount) { // should be ended
      if (!this.sent) {
        var frameEnd = {
          op: 'END',
          chunkCount: this.chunkCount,
          bytesLength: this.bytesLength
        };
        console.log('SEND: ' + JSON.stringify(frameEnd));
        data = stringToBytes(JSON.stringify(frameEnd));
        chrome.sockets.udp.send(this.socketCreateInfo.socketId, data, this.device.address, Transfer.PORT, function (result) {
          if (result < 0) {
            throw new Error('send failed: ' + JSON.stringify(result));
          } else {
            // ended!!!
            that.sent = true;
          }
        });
      } else {
        // ended and do nothing
      }
    } else {
      // sending a single chunk bytes
      var bytesLength = 0;
      if (this.sentChunk === this.chunkCount - 1) {
        bytesLength = (this.bytesLength % Transfer.CHUNK_SIZE === 0) ? Transfer.CHUNK_SIZE : (this.bytesLength % Transfer.CHUNK_SIZE);
      } else {
        bytesLength = Transfer.CHUNK_SIZE;
      }
      this.sentChunk = this.sentChunk + 1;
      var frameData = {
        op: 'DATA',
        chunkIndex: this.sentChunk,
        bytesLength: bytesLength,
        data: bytesToString(this.data.slice((this.sentChunk - 1) * Transfer.CHUNK_SIZE, this.bytesLength)),
      };
      console.log('SEND: ' + JSON.stringify(frameData));
      data = stringToBytes(JSON.stringify(frameData));
      chrome.sockets.udp.send(this.socketCreateInfo.socketId, data, this.device.address, Transfer.PORT, function (result) {
        if (result < 0) {
          throw new Error('send failed: ' + JSON.stringify(result));
        } else {
          that.send();// continue
        }
      });
    }
  } else { // start
    var frameStart = {
      op: 'START',
      chunkCount: this.chunkCount,
      bytesLength: this.bytesLength
    };
    console.log('SEND: ' + JSON.stringify(frameStart));
    data = stringToBytes(JSON.stringify(frameStart));
    chrome.sockets.udp.send(this.socketCreateInfo.socketId, data, this.device.address, Transfer.PORT, function (result) {
      if (result < 0) {
        throw new Error('send failed: ' + JSON.stringify(result));
      } else {
        // success
        that.sending = true;
        that.sentChunk = 0;
        that.send(); // continue
      }
    });
  }
};

Transfer.prototype.stopSend = function () {
  this.isStopped = true;
};

Transfer.prototype.bindRecvListener = function () {
  var that = this;
  this.unbindRecvListener(); // if needed
  this.recvListener = function (info) {
    if (that.socketCreateInfo.socketId !== info.socketId) return;

    console.log('Receive: ' + bytesToString(info.data));
  };
  this.recvErrorListener = function (info) {
    if (that.socketCreateInfo.socketId !== info.socketId) return;
    var socketId = info.socketId;
    var resultCode = info.resultCode;
    console.error('recv error: socketId=' + socketId + ' resultCode=' + resultCode);
  };
  chrome.sockets.udp.onReceive.addListener(this.recvListener);
  chrome.sockets.udp.onReceiveError.addListener(this.recvErrorListener);
};

Transfer.prototype.unbindRecvListener = function () {
  if (this.recvListener) {
    chrome.sockets.udp.onReceive.removeListener(this.recvListener);
    this.recvListener = null;
  }
  if (this.recvErrorListener) {
    chrome.sockets.udp.onReceiveError.removeListener(this.recvErrorListener);
    this.recvErrorListener = null;
  }
};
