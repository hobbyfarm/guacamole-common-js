// ../guac-dist/.tmp-guac/guacamole-common-js/all.js
var Guacamole = Guacamole || {};
Guacamole.ArrayBufferReader = function(stream) {
  var guac_reader = this;
  stream.onblob = function(data) {
    var binary = globalThis.atob(data);
    var arrayBuffer = new ArrayBuffer(binary.length);
    var bufferView = new Uint8Array(arrayBuffer);
    for (var i = 0; i < binary.length; i++)
      bufferView[i] = binary.charCodeAt(i);
    if (guac_reader.ondata)
      guac_reader.ondata(arrayBuffer);
  };
  stream.onend = function() {
    if (guac_reader.onend)
      guac_reader.onend();
  };
  this.ondata = null;
  this.onend = null;
};
var Guacamole = Guacamole || {};
Guacamole.ArrayBufferWriter = function(stream) {
  var guac_writer = this;
  stream.onack = function(status) {
    if (guac_writer.onack)
      guac_writer.onack(status);
  };
  function __send_blob(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.byteLength; i++)
      binary += String.fromCharCode(bytes[i]);
    stream.sendBlob(globalThis.btoa(binary));
  }
  this.blobLength = Guacamole.ArrayBufferWriter.DEFAULT_BLOB_LENGTH;
  this.sendData = function(data) {
    var bytes = new Uint8Array(data);
    if (bytes.length <= guac_writer.blobLength)
      __send_blob(bytes);
    else {
      for (var offset = 0; offset < bytes.length; offset += guac_writer.blobLength)
        __send_blob(bytes.subarray(offset, offset + guac_writer.blobLength));
    }
  };
  this.sendEnd = function() {
    stream.sendEnd();
  };
  this.onack = null;
};
Guacamole.ArrayBufferWriter.DEFAULT_BLOB_LENGTH = 6048;
var Guacamole = Guacamole || {};
Guacamole.AudioContextFactory = {
  /**
   * A singleton instance of a Web Audio API AudioContext object, or null if
   * no instance has yes been created. This property may be manually set if
   * you wish to supply your own AudioContext instance, but care must be
   * taken to do so as early as possible. Assignments to this property will
   * not retroactively affect the value returned by previous calls to
   * getAudioContext().
   *
   * @type {AudioContext}
   */
  "singleton": null,
  /**
   * Returns a singleton instance of a Web Audio API AudioContext object.
   *
   * @return {AudioContext}
   *     A singleton instance of a Web Audio API AudioContext object, or null
   *     if the Web Audio API is not supported.
   */
  "getAudioContext": function getAudioContext() {
    var AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) {
      try {
        if (!Guacamole.AudioContextFactory.singleton)
          Guacamole.AudioContextFactory.singleton = new AudioContext();
        return Guacamole.AudioContextFactory.singleton;
      } catch (e) {
      }
    }
    return null;
  }
};
var Guacamole = Guacamole || {};
Guacamole.AudioPlayer = function AudioPlayer() {
  this.sync = function sync() {
  };
};
Guacamole.AudioPlayer.isSupportedType = function isSupportedType(mimetype) {
  return Guacamole.RawAudioPlayer.isSupportedType(mimetype);
};
Guacamole.AudioPlayer.getSupportedTypes = function getSupportedTypes() {
  return Guacamole.RawAudioPlayer.getSupportedTypes();
};
Guacamole.AudioPlayer.getInstance = function getInstance(stream, mimetype) {
  if (Guacamole.RawAudioPlayer.isSupportedType(mimetype))
    return new Guacamole.RawAudioPlayer(stream, mimetype);
  return null;
};
Guacamole.RawAudioPlayer = function RawAudioPlayer(stream, mimetype) {
  var format = Guacamole.RawAudioFormat.parse(mimetype);
  var context = Guacamole.AudioContextFactory.getAudioContext();
  var nextPacketTime = context.currentTime;
  var reader = new Guacamole.ArrayBufferReader(stream);
  var MIN_SPLIT_SIZE = 0.02;
  var maxLatency = 0.3;
  var SampleArray = format.bytesPerSample === 1 ? globalThis.Int8Array : globalThis.Int16Array;
  var maxSampleValue = format.bytesPerSample === 1 ? 128 : 32768;
  var packetQueue = [];
  var joinAudioPackets = function joinAudioPackets2(packets) {
    if (packets.length <= 1)
      return packets[0];
    var totalLength = 0;
    packets.forEach(function addPacketLengths(packet) {
      totalLength += packet.length;
    });
    var offset = 0;
    var joined = new SampleArray(totalLength);
    packets.forEach(function appendPacket(packet) {
      joined.set(packet, offset);
      offset += packet.length;
    });
    return joined;
  };
  var splitAudioPacket = function splitAudioPacket2(data) {
    var minValue = Number.MAX_VALUE;
    var optimalSplitLength = data.length;
    var samples = Math.floor(data.length / format.channels);
    var minSplitSamples = Math.floor(format.rate * MIN_SPLIT_SIZE);
    var start = Math.max(
      format.channels * minSplitSamples,
      format.channels * (samples - minSplitSamples)
    );
    for (var offset = start; offset < data.length; offset += format.channels) {
      var totalValue = 0;
      for (var channel = 0; channel < format.channels; channel++) {
        totalValue += Math.abs(data[offset + channel]);
      }
      if (totalValue <= minValue) {
        optimalSplitLength = offset + format.channels;
        minValue = totalValue;
      }
    }
    if (optimalSplitLength === data.length)
      return [data];
    return [
      new SampleArray(data.buffer.slice(0, optimalSplitLength * format.bytesPerSample)),
      new SampleArray(data.buffer.slice(optimalSplitLength * format.bytesPerSample))
    ];
  };
  var pushAudioPacket = function pushAudioPacket2(data) {
    packetQueue.push(new SampleArray(data));
  };
  var shiftAudioPacket = function shiftAudioPacket2() {
    var data = joinAudioPackets(packetQueue);
    if (!data)
      return null;
    packetQueue = splitAudioPacket(data);
    data = packetQueue.shift();
    return data;
  };
  var toAudioBuffer = function toAudioBuffer2(data) {
    var samples = data.length / format.channels;
    var packetTime = context.currentTime;
    if (nextPacketTime < packetTime)
      nextPacketTime = packetTime;
    var audioBuffer = context.createBuffer(format.channels, samples, format.rate);
    for (var channel = 0; channel < format.channels; channel++) {
      var audioData = audioBuffer.getChannelData(channel);
      var offset = channel;
      for (var i = 0; i < samples; i++) {
        audioData[i] = data[offset] / maxSampleValue;
        offset += format.channels;
      }
    }
    return audioBuffer;
  };
  reader.ondata = function playReceivedAudio(data) {
    pushAudioPacket(new SampleArray(data));
    var packet = shiftAudioPacket();
    if (!packet)
      return;
    var packetTime = context.currentTime;
    if (nextPacketTime < packetTime)
      nextPacketTime = packetTime;
    var source = context.createBufferSource();
    source.connect(context.destination);
    if (!source.start)
      source.start = source.noteOn;
    source.buffer = toAudioBuffer(packet);
    source.start(nextPacketTime);
    nextPacketTime += packet.length / format.channels / format.rate;
  };
  this.sync = function sync() {
    var now = context.currentTime;
    nextPacketTime = Math.min(nextPacketTime, now + maxLatency);
  };
};
Guacamole.RawAudioPlayer.prototype = new Guacamole.AudioPlayer();
Guacamole.RawAudioPlayer.isSupportedType = function isSupportedType2(mimetype) {
  if (!Guacamole.AudioContextFactory.getAudioContext())
    return false;
  return Guacamole.RawAudioFormat.parse(mimetype) !== null;
};
Guacamole.RawAudioPlayer.getSupportedTypes = function getSupportedTypes2() {
  if (!Guacamole.AudioContextFactory.getAudioContext())
    return [];
  return [
    "audio/L8",
    "audio/L16"
  ];
};
var Guacamole = Guacamole || {};
Guacamole.AudioRecorder = function AudioRecorder() {
  this.onclose = null;
  this.onerror = null;
};
Guacamole.AudioRecorder.isSupportedType = function isSupportedType3(mimetype) {
  return Guacamole.RawAudioRecorder.isSupportedType(mimetype);
};
Guacamole.AudioRecorder.getSupportedTypes = function getSupportedTypes3() {
  return Guacamole.RawAudioRecorder.getSupportedTypes();
};
Guacamole.AudioRecorder.getInstance = function getInstance2(stream, mimetype) {
  if (Guacamole.RawAudioRecorder.isSupportedType(mimetype))
    return new Guacamole.RawAudioRecorder(stream, mimetype);
  return null;
};
Guacamole.RawAudioRecorder = function RawAudioRecorder(stream, mimetype) {
  var recorder = this;
  var BUFFER_SIZE = 2048;
  var LANCZOS_WINDOW_SIZE = 3;
  var format = Guacamole.RawAudioFormat.parse(mimetype);
  var context = Guacamole.AudioContextFactory.getAudioContext();
  if (!navigator.mediaDevices)
    navigator.mediaDevices = {};
  if (!navigator.mediaDevices.getUserMedia)
    navigator.mediaDevices.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia).bind(navigator);
  var writer = new Guacamole.ArrayBufferWriter(stream);
  var SampleArray = format.bytesPerSample === 1 ? globalThis.Int8Array : globalThis.Int16Array;
  var maxSampleValue = format.bytesPerSample === 1 ? 128 : 32768;
  var readSamples = 0;
  var writtenSamples = 0;
  var mediaStream = null;
  var source = null;
  var processor = null;
  var sinc = function sinc2(x) {
    if (x === 0)
      return 1;
    var piX = Math.PI * x;
    return Math.sin(piX) / piX;
  };
  var lanczos = function lanczos2(x, a) {
    if (-a < x && x < a)
      return sinc(x) * sinc(x / a);
    return 0;
  };
  var interpolateSample = function getValueAt(audioData, t) {
    var index = (audioData.length - 1) * t;
    var start = Math.floor(index) - LANCZOS_WINDOW_SIZE + 1;
    var end = Math.floor(index) + LANCZOS_WINDOW_SIZE;
    var sum = 0;
    for (var i = start; i <= end; i++) {
      sum += (audioData[i] || 0) * lanczos(index - i, LANCZOS_WINDOW_SIZE);
    }
    return sum;
  };
  var toSampleArray = function toSampleArray2(audioBuffer) {
    var inSamples = audioBuffer.length;
    readSamples += inSamples;
    var expectedWrittenSamples = Math.round(readSamples * format.rate / audioBuffer.sampleRate);
    var outSamples = expectedWrittenSamples - writtenSamples;
    writtenSamples += outSamples;
    var data = new SampleArray(outSamples * format.channels);
    for (var channel = 0; channel < format.channels; channel++) {
      var audioData = audioBuffer.getChannelData(channel);
      var offset = channel;
      for (var i = 0; i < outSamples; i++) {
        data[offset] = interpolateSample(audioData, i / (outSamples - 1)) * maxSampleValue;
        offset += format.channels;
      }
    }
    return data;
  };
  var streamReceived = function streamReceived2(stream2) {
    processor = context.createScriptProcessor(BUFFER_SIZE, format.channels, format.channels);
    processor.connect(context.destination);
    processor.onaudioprocess = function processAudio(e) {
      writer.sendData(toSampleArray(e.inputBuffer).buffer);
    };
    source = context.createMediaStreamSource(stream2);
    source.connect(processor);
    if (context.state === "suspended")
      context.resume();
    mediaStream = stream2;
  };
  var streamDenied = function streamDenied2() {
    writer.sendEnd();
    if (recorder.onerror)
      recorder.onerror();
  };
  var beginAudioCapture = function beginAudioCapture2() {
    var promise = navigator.mediaDevices.getUserMedia({
      "audio": true
    }, streamReceived, streamDenied);
    if (promise && promise.then)
      promise.then(streamReceived, streamDenied);
  };
  var stopAudioCapture = function stopAudioCapture2() {
    if (source)
      source.disconnect();
    if (processor)
      processor.disconnect();
    if (mediaStream) {
      var tracks = mediaStream.getTracks();
      for (var i = 0; i < tracks.length; i++)
        tracks[i].stop();
    }
    processor = null;
    source = null;
    mediaStream = null;
    writer.sendEnd();
  };
  writer.onack = function audioStreamAcknowledged(status) {
    if (status.code === Guacamole.Status.Code.SUCCESS && !mediaStream)
      beginAudioCapture();
    else {
      stopAudioCapture();
      writer.onack = null;
      if (status.code === Guacamole.Status.Code.RESOURCE_CLOSED) {
        if (recorder.onclose)
          recorder.onclose();
      } else {
        if (recorder.onerror)
          recorder.onerror();
      }
    }
  };
};
Guacamole.RawAudioRecorder.prototype = new Guacamole.AudioRecorder();
Guacamole.RawAudioRecorder.isSupportedType = function isSupportedType4(mimetype) {
  if (!Guacamole.AudioContextFactory.getAudioContext())
    return false;
  return Guacamole.RawAudioFormat.parse(mimetype) !== null;
};
Guacamole.RawAudioRecorder.getSupportedTypes = function getSupportedTypes4() {
  if (!Guacamole.AudioContextFactory.getAudioContext())
    return [];
  return [
    "audio/L8",
    "audio/L16"
  ];
};
var Guacamole = Guacamole || {};
Guacamole.BlobReader = function(stream, mimetype) {
  var guac_reader = this;
  var length = 0;
  var blob_builder;
  if (globalThis.BlobBuilder) blob_builder = new BlobBuilder();
  else if (globalThis.WebKitBlobBuilder) blob_builder = new WebKitBlobBuilder();
  else if (globalThis.MozBlobBuilder) blob_builder = new MozBlobBuilder();
  else
    blob_builder = new function() {
      var blobs = [];
      this.append = function(data) {
        blobs.push(new Blob([data], { "type": mimetype }));
      };
      this.getBlob = function() {
        return new Blob(blobs, { "type": mimetype });
      };
    }();
  stream.onblob = function(data) {
    var binary = globalThis.atob(data);
    var arrayBuffer = new ArrayBuffer(binary.length);
    var bufferView = new Uint8Array(arrayBuffer);
    for (var i = 0; i < binary.length; i++)
      bufferView[i] = binary.charCodeAt(i);
    blob_builder.append(arrayBuffer);
    length += arrayBuffer.byteLength;
    if (guac_reader.onprogress)
      guac_reader.onprogress(arrayBuffer.byteLength);
    stream.sendAck("OK", 0);
  };
  stream.onend = function() {
    if (guac_reader.onend)
      guac_reader.onend();
  };
  this.getLength = function() {
    return length;
  };
  this.getBlob = function() {
    return blob_builder.getBlob();
  };
  this.onprogress = null;
  this.onend = null;
};
var Guacamole = Guacamole || {};
Guacamole.BlobWriter = function BlobWriter(stream) {
  var guacWriter = this;
  var arrayBufferWriter = new Guacamole.ArrayBufferWriter(stream);
  arrayBufferWriter.onack = function(status) {
    if (guacWriter.onack)
      guacWriter.onack(status);
  };
  var slice = function slice2(blob, start, end) {
    var sliceImplementation = (blob.slice || blob.webkitSlice || blob.mozSlice).bind(blob);
    var length = end - start;
    if (length !== end) {
      var sliceResult = sliceImplementation(start, length);
      if (sliceResult.size === length)
        return sliceResult;
    }
    return sliceImplementation(start, end);
  };
  this.sendBlob = function sendBlob(blob) {
    var offset = 0;
    var reader = new FileReader();
    var readNextChunk = function readNextChunk2() {
      if (offset >= blob.size) {
        if (guacWriter.oncomplete)
          guacWriter.oncomplete(blob);
        return;
      }
      var chunk = slice(blob, offset, offset + arrayBufferWriter.blobLength);
      offset += arrayBufferWriter.blobLength;
      reader.readAsArrayBuffer(chunk);
    };
    reader.onload = function chunkLoadComplete() {
      arrayBufferWriter.sendData(reader.result);
      arrayBufferWriter.onack = function sendMoreChunks(status) {
        if (guacWriter.onack)
          guacWriter.onack(status);
        if (status.isError())
          return;
        if (guacWriter.onprogress)
          guacWriter.onprogress(blob, offset - arrayBufferWriter.blobLength);
        readNextChunk();
      };
    };
    reader.onerror = function chunkLoadFailed() {
      if (guacWriter.onerror)
        guacWriter.onerror(blob, offset, reader.error);
    };
    readNextChunk();
  };
  this.sendEnd = function sendEnd() {
    arrayBufferWriter.sendEnd();
  };
  this.onack = null;
  this.onerror = null;
  this.onprogress = null;
  this.oncomplete = null;
};
var Guacamole = Guacamole || {};
Guacamole.Client = function(tunnel) {
  var guac_client = this;
  var STATE_IDLE = 0;
  var STATE_CONNECTING = 1;
  var STATE_WAITING = 2;
  var STATE_CONNECTED = 3;
  var STATE_DISCONNECTING = 4;
  var STATE_DISCONNECTED = 5;
  var currentState = STATE_IDLE;
  var currentTimestamp = 0;
  var KEEP_ALIVE_FREQUENCY = 5e3;
  var keepAliveTimeout = null;
  var lastSentKeepAlive = 0;
  var lineCap = {
    0: "butt",
    1: "round",
    2: "square"
  };
  var lineJoin = {
    0: "bevel",
    1: "miter",
    2: "round"
  };
  var display = new Guacamole.Display();
  var layers = {};
  var audioPlayers = {};
  var videoPlayers = {};
  var parsers = [];
  var streams = [];
  var objects = [];
  var stream_indices = new Guacamole.IntegerPool();
  var output_streams = [];
  function setState(state) {
    if (state != currentState) {
      currentState = state;
      if (guac_client.onstatechange)
        guac_client.onstatechange(currentState);
    }
  }
  function isConnected() {
    return currentState == STATE_CONNECTED || currentState == STATE_WAITING;
  }
  this.exportState = function exportState(callback) {
    var state = {
      "currentState": currentState,
      "currentTimestamp": currentTimestamp,
      "layers": {}
    };
    var layersSnapshot = {};
    for (var key in layers) {
      layersSnapshot[key] = layers[key];
    }
    display.flush(function populateLayers() {
      for (var key2 in layersSnapshot) {
        var index = parseInt(key2);
        var layer = layersSnapshot[key2];
        var canvas = layer.toCanvas();
        var exportLayer = {
          "width": layer.width,
          "height": layer.height
        };
        if (layer.width && layer.height)
          exportLayer.url = canvas.toDataURL("image/png");
        if (index > 0) {
          exportLayer.x = layer.x;
          exportLayer.y = layer.y;
          exportLayer.z = layer.z;
          exportLayer.alpha = layer.alpha;
          exportLayer.matrix = layer.matrix;
          exportLayer.parent = getLayerIndex(layer.parent);
        }
        state.layers[key2] = exportLayer;
      }
      callback(state);
    });
  };
  this.importState = function importState(state, callback) {
    var key;
    var index;
    currentState = state.currentState;
    currentTimestamp = state.currentTimestamp;
    display.cancel();
    for (key in layers) {
      index = parseInt(key);
      if (index > 0)
        layers[key].dispose();
    }
    layers = {};
    for (key in state.layers) {
      index = parseInt(key);
      var importLayer = state.layers[key];
      var layer = getLayer(index);
      display.resize(layer, importLayer.width, importLayer.height);
      if (importLayer.url) {
        display.setChannelMask(layer, Guacamole.Layer.SRC);
        display.draw(layer, 0, 0, importLayer.url);
      }
      if (index > 0 && importLayer.parent >= 0) {
        var parent = getLayer(importLayer.parent);
        display.move(layer, parent, importLayer.x, importLayer.y, importLayer.z);
        display.shade(layer, importLayer.alpha);
        var matrix = importLayer.matrix;
        display.distort(
          layer,
          matrix[0],
          matrix[1],
          matrix[2],
          matrix[3],
          matrix[4],
          matrix[5]
        );
      }
    }
    display.flush(callback);
  };
  this.getDisplay = function() {
    return display;
  };
  this.sendSize = function(width, height) {
    if (!isConnected())
      return;
    tunnel.sendMessage("size", width, height);
  };
  this.sendKeyEvent = function(pressed, keysym) {
    if (!isConnected())
      return;
    tunnel.sendMessage("key", keysym, pressed);
  };
  this.sendMouseState = function sendMouseState(mouseState, applyDisplayScale) {
    if (!isConnected())
      return;
    var x = mouseState.x;
    var y = mouseState.y;
    if (applyDisplayScale) {
      x /= display.getScale();
      y /= display.getScale();
    }
    display.moveCursor(
      Math.floor(x),
      Math.floor(y)
    );
    var buttonMask = 0;
    if (mouseState.left) buttonMask |= 1;
    if (mouseState.middle) buttonMask |= 2;
    if (mouseState.right) buttonMask |= 4;
    if (mouseState.up) buttonMask |= 8;
    if (mouseState.down) buttonMask |= 16;
    tunnel.sendMessage("mouse", Math.floor(x), Math.floor(y), buttonMask);
  };
  this.sendTouchState = function sendTouchState(touchState, applyDisplayScale) {
    if (!isConnected())
      return;
    var x = touchState.x;
    var y = touchState.y;
    if (applyDisplayScale) {
      x /= display.getScale();
      y /= display.getScale();
    }
    tunnel.sendMessage(
      "touch",
      touchState.id,
      Math.floor(x),
      Math.floor(y),
      Math.floor(touchState.radiusX),
      Math.floor(touchState.radiusY),
      touchState.angle,
      touchState.force
    );
  };
  this.createOutputStream = function createOutputStream() {
    var index = stream_indices.next();
    var stream = output_streams[index] = new Guacamole.OutputStream(guac_client, index);
    return stream;
  };
  this.createAudioStream = function(mimetype) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("audio", stream.index, mimetype);
    return stream;
  };
  this.createFileStream = function(mimetype, filename) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("file", stream.index, mimetype, filename);
    return stream;
  };
  this.createPipeStream = function(mimetype, name) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("pipe", stream.index, mimetype, name);
    return stream;
  };
  this.createClipboardStream = function(mimetype) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("clipboard", stream.index, mimetype);
    return stream;
  };
  this.createArgumentValueStream = function createArgumentValueStream(mimetype, name) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("argv", stream.index, mimetype, name);
    return stream;
  };
  this.createObjectOutputStream = function createObjectOutputStream(index, mimetype, name) {
    var stream = guac_client.createOutputStream();
    tunnel.sendMessage("put", index, stream.index, mimetype, name);
    return stream;
  };
  this.requestObjectInputStream = function requestObjectInputStream(index, name) {
    if (!isConnected())
      return;
    tunnel.sendMessage("get", index, name);
  };
  this.sendAck = function(index, message, code) {
    if (!isConnected())
      return;
    tunnel.sendMessage("ack", index, message, code);
  };
  this.sendBlob = function(index, data) {
    if (!isConnected())
      return;
    tunnel.sendMessage("blob", index, data);
  };
  this.endStream = function(index) {
    if (!isConnected())
      return;
    tunnel.sendMessage("end", index);
    if (output_streams[index]) {
      stream_indices.free(index);
      delete output_streams[index];
    }
  };
  this.onstatechange = null;
  this.onname = null;
  this.onerror = null;
  this.onmsg = null;
  this.onjoin = null;
  this.onleave = null;
  this.onaudio = null;
  this.onvideo = null;
  this.onmultitouch = null;
  this.onargv = null;
  this.onclipboard = null;
  this.onfile = null;
  this.onfilesystem = null;
  this.onpipe = null;
  this.onrequired = null;
  this.onsync = null;
  var getLayer = function getLayer2(index) {
    var layer = layers[index];
    if (!layer) {
      if (index === 0)
        layer = display.getDefaultLayer();
      else if (index > 0)
        layer = display.createLayer();
      else
        layer = display.createBuffer();
      layers[index] = layer;
    }
    return layer;
  };
  var getLayerIndex = function getLayerIndex2(layer) {
    if (!layer)
      return null;
    for (var key in layers) {
      if (layer === layers[key])
        return parseInt(key);
    }
    return null;
  };
  function getParser(index) {
    var parser = parsers[index];
    if (parser == null) {
      parser = parsers[index] = new Guacamole.Parser();
      parser.oninstruction = tunnel.oninstruction;
    }
    return parser;
  }
  var layerPropertyHandlers = {
    "miter-limit": function(layer, value) {
      display.setMiterLimit(layer, parseFloat(value));
    },
    "multi-touch": function layerSupportsMultiTouch(layer, value) {
      if (guac_client.onmultitouch && layer instanceof Guacamole.Display.VisibleLayer)
        guac_client.onmultitouch(layer, parseInt(value));
    }
  };
  var instructionHandlers = {
    "ack": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var reason = parameters[1];
      var code = parseInt(parameters[2]);
      var stream = output_streams[stream_index];
      if (stream) {
        if (stream.onack)
          stream.onack(new Guacamole.Status(code, reason));
        if (code >= 256 && output_streams[stream_index] === stream) {
          stream_indices.free(stream_index);
          delete output_streams[stream_index];
        }
      }
    },
    "arc": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var x = parseInt(parameters[1]);
      var y = parseInt(parameters[2]);
      var radius = parseInt(parameters[3]);
      var startAngle = parseFloat(parameters[4]);
      var endAngle = parseFloat(parameters[5]);
      var negative = parseInt(parameters[6]);
      display.arc(layer, x, y, radius, startAngle, endAngle, negative != 0);
    },
    "argv": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var mimetype = parameters[1];
      var name = parameters[2];
      if (guac_client.onargv) {
        var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
        guac_client.onargv(stream, mimetype, name);
      } else
        guac_client.sendAck(stream_index, "Receiving argument values unsupported", 256);
    },
    "audio": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var mimetype = parameters[1];
      var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
      var audioPlayer = null;
      if (guac_client.onaudio)
        audioPlayer = guac_client.onaudio(stream, mimetype);
      if (!audioPlayer)
        audioPlayer = Guacamole.AudioPlayer.getInstance(stream, mimetype);
      if (audioPlayer) {
        audioPlayers[stream_index] = audioPlayer;
        guac_client.sendAck(stream_index, "OK", 0);
      } else
        guac_client.sendAck(stream_index, "BAD TYPE", 783);
    },
    "blob": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var data = parameters[1];
      var stream = streams[stream_index];
      if (stream && stream.onblob)
        stream.onblob(data);
    },
    "body": function handleBody(parameters) {
      var objectIndex = parseInt(parameters[0]);
      var object = objects[objectIndex];
      var streamIndex = parseInt(parameters[1]);
      var mimetype = parameters[2];
      var name = parameters[3];
      if (object && object.onbody) {
        var stream = streams[streamIndex] = new Guacamole.InputStream(guac_client, streamIndex);
        object.onbody(stream, mimetype, name);
      } else
        guac_client.sendAck(streamIndex, "Receipt of body unsupported", 256);
    },
    "cfill": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var r = parseInt(parameters[2]);
      var g = parseInt(parameters[3]);
      var b = parseInt(parameters[4]);
      var a = parseInt(parameters[5]);
      display.setChannelMask(layer, channelMask);
      display.fillColor(layer, r, g, b, a);
    },
    "clip": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.clip(layer);
    },
    "clipboard": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var mimetype = parameters[1];
      if (guac_client.onclipboard) {
        var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
        guac_client.onclipboard(stream, mimetype);
      } else
        guac_client.sendAck(stream_index, "Clipboard unsupported", 256);
    },
    "close": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.close(layer);
    },
    "copy": function(parameters) {
      var srcL = getLayer(parseInt(parameters[0]));
      var srcX = parseInt(parameters[1]);
      var srcY = parseInt(parameters[2]);
      var srcWidth = parseInt(parameters[3]);
      var srcHeight = parseInt(parameters[4]);
      var channelMask = parseInt(parameters[5]);
      var dstL = getLayer(parseInt(parameters[6]));
      var dstX = parseInt(parameters[7]);
      var dstY = parseInt(parameters[8]);
      display.setChannelMask(dstL, channelMask);
      display.copy(
        srcL,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        dstL,
        dstX,
        dstY
      );
    },
    "cstroke": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var cap = lineCap[parseInt(parameters[2])];
      var join = lineJoin[parseInt(parameters[3])];
      var thickness = parseInt(parameters[4]);
      var r = parseInt(parameters[5]);
      var g = parseInt(parameters[6]);
      var b = parseInt(parameters[7]);
      var a = parseInt(parameters[8]);
      display.setChannelMask(layer, channelMask);
      display.strokeColor(layer, cap, join, thickness, r, g, b, a);
    },
    "cursor": function(parameters) {
      var cursorHotspotX = parseInt(parameters[0]);
      var cursorHotspotY = parseInt(parameters[1]);
      var srcL = getLayer(parseInt(parameters[2]));
      var srcX = parseInt(parameters[3]);
      var srcY = parseInt(parameters[4]);
      var srcWidth = parseInt(parameters[5]);
      var srcHeight = parseInt(parameters[6]);
      display.setCursor(
        cursorHotspotX,
        cursorHotspotY,
        srcL,
        srcX,
        srcY,
        srcWidth,
        srcHeight
      );
    },
    "curve": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var cp1x = parseInt(parameters[1]);
      var cp1y = parseInt(parameters[2]);
      var cp2x = parseInt(parameters[3]);
      var cp2y = parseInt(parameters[4]);
      var x = parseInt(parameters[5]);
      var y = parseInt(parameters[6]);
      display.curveTo(layer, cp1x, cp1y, cp2x, cp2y, x, y);
    },
    "disconnect": function handleDisconnect(parameters) {
      guac_client.disconnect();
    },
    "dispose": function(parameters) {
      var layer_index = parseInt(parameters[0]);
      if (layer_index > 0) {
        var layer = getLayer(layer_index);
        display.dispose(layer);
        delete layers[layer_index];
      } else if (layer_index < 0)
        delete layers[layer_index];
    },
    "distort": function(parameters) {
      var layer_index = parseInt(parameters[0]);
      var a = parseFloat(parameters[1]);
      var b = parseFloat(parameters[2]);
      var c = parseFloat(parameters[3]);
      var d = parseFloat(parameters[4]);
      var e = parseFloat(parameters[5]);
      var f = parseFloat(parameters[6]);
      if (layer_index >= 0) {
        var layer = getLayer(layer_index);
        display.distort(layer, a, b, c, d, e, f);
      }
    },
    "error": function(parameters) {
      var reason = parameters[0];
      var code = parseInt(parameters[1]);
      if (guac_client.onerror)
        guac_client.onerror(new Guacamole.Status(code, reason));
      guac_client.disconnect();
    },
    "end": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var stream = streams[stream_index];
      if (stream) {
        if (stream.onend)
          stream.onend();
        delete streams[stream_index];
      }
    },
    "file": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var mimetype = parameters[1];
      var filename = parameters[2];
      if (guac_client.onfile) {
        var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
        guac_client.onfile(stream, mimetype, filename);
      } else
        guac_client.sendAck(stream_index, "File transfer unsupported", 256);
    },
    "filesystem": function handleFilesystem(parameters) {
      var objectIndex = parseInt(parameters[0]);
      var name = parameters[1];
      if (guac_client.onfilesystem) {
        var object = objects[objectIndex] = new Guacamole.Object(guac_client, objectIndex);
        guac_client.onfilesystem(object, name);
      }
    },
    "identity": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.setTransform(layer, 1, 0, 0, 1, 0, 0);
    },
    "img": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var channelMask = parseInt(parameters[1]);
      var layer = getLayer(parseInt(parameters[2]));
      var mimetype = parameters[3];
      var x = parseInt(parameters[4]);
      var y = parseInt(parameters[5]);
      var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
      display.setChannelMask(layer, channelMask);
      display.drawStream(layer, x, y, stream, mimetype);
    },
    "jpeg": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var x = parseInt(parameters[2]);
      var y = parseInt(parameters[3]);
      var data = parameters[4];
      display.setChannelMask(layer, channelMask);
      display.draw(layer, x, y, "data:image/jpeg;base64," + data);
    },
    "lfill": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var srcLayer = getLayer(parseInt(parameters[2]));
      display.setChannelMask(layer, channelMask);
      display.fillLayer(layer, srcLayer);
    },
    "line": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var x = parseInt(parameters[1]);
      var y = parseInt(parameters[2]);
      display.lineTo(layer, x, y);
    },
    "lstroke": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var srcLayer = getLayer(parseInt(parameters[2]));
      display.setChannelMask(layer, channelMask);
      display.strokeLayer(layer, srcLayer);
    },
    "mouse": function handleMouse(parameters) {
      var x = parseInt(parameters[0]);
      var y = parseInt(parameters[1]);
      display.showCursor(true);
      display.moveCursor(x, y);
    },
    "move": function(parameters) {
      var layer_index = parseInt(parameters[0]);
      var parent_index = parseInt(parameters[1]);
      var x = parseInt(parameters[2]);
      var y = parseInt(parameters[3]);
      var z = parseInt(parameters[4]);
      if (layer_index > 0 && parent_index >= 0) {
        var layer = getLayer(layer_index);
        var parent = getLayer(parent_index);
        display.move(layer, parent, x, y, z);
      }
    },
    "msg": function(parameters) {
      var userID;
      var username;
      var allowDefault = true;
      var msgid = parseInt(parameters[0]);
      if (guac_client.onmsg) {
        allowDefault = guac_client.onmsg(msgid, parameters.slice(1));
        if (allowDefault === void 0)
          allowDefault = true;
      }
      if (allowDefault) {
        switch (msgid) {
          case Guacamole.Client.Message.USER_JOINED:
            userID = parameters[1];
            username = parameters[2];
            if (guac_client.onjoin)
              guac_client.onjoin(userID, username);
            break;
          case Guacamole.Client.Message.USER_LEFT:
            userID = parameters[1];
            username = parameters[2];
            if (guac_client.onleave)
              guac_client.onleave(userID, username);
            break;
        }
      }
    },
    "name": function(parameters) {
      if (guac_client.onname) guac_client.onname(parameters[0]);
    },
    "nest": function(parameters) {
      var parser = getParser(parseInt(parameters[0]));
      parser.receive(parameters[1]);
    },
    "pipe": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var mimetype = parameters[1];
      var name = parameters[2];
      if (guac_client.onpipe) {
        var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
        guac_client.onpipe(stream, mimetype, name);
      } else
        guac_client.sendAck(stream_index, "Named pipes unsupported", 256);
    },
    "png": function(parameters) {
      var channelMask = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var x = parseInt(parameters[2]);
      var y = parseInt(parameters[3]);
      var data = parameters[4];
      display.setChannelMask(layer, channelMask);
      display.draw(layer, x, y, "data:image/png;base64," + data);
    },
    "pop": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.pop(layer);
    },
    "push": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.push(layer);
    },
    "rect": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var x = parseInt(parameters[1]);
      var y = parseInt(parameters[2]);
      var w = parseInt(parameters[3]);
      var h = parseInt(parameters[4]);
      display.rect(layer, x, y, w, h);
    },
    "required": function required(parameters) {
      if (guac_client.onrequired) guac_client.onrequired(parameters);
    },
    "reset": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      display.reset(layer);
    },
    "set": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var name = parameters[1];
      var value = parameters[2];
      var handler = layerPropertyHandlers[name];
      if (handler)
        handler(layer, value);
    },
    "shade": function(parameters) {
      var layer_index = parseInt(parameters[0]);
      var a = parseInt(parameters[1]);
      if (layer_index >= 0) {
        var layer = getLayer(layer_index);
        display.shade(layer, a);
      }
    },
    "size": function(parameters) {
      var layer_index = parseInt(parameters[0]);
      var layer = getLayer(layer_index);
      var width = parseInt(parameters[1]);
      var height = parseInt(parameters[2]);
      display.resize(layer, width, height);
    },
    "start": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var x = parseInt(parameters[1]);
      var y = parseInt(parameters[2]);
      display.moveTo(layer, x, y);
    },
    "sync": function(parameters) {
      var timestamp = parseInt(parameters[0]);
      display.flush(function displaySyncComplete() {
        for (var index in audioPlayers) {
          var audioPlayer = audioPlayers[index];
          if (audioPlayer)
            audioPlayer.sync();
        }
        if (timestamp !== currentTimestamp) {
          tunnel.sendMessage("sync", timestamp);
          currentTimestamp = timestamp;
        }
      });
      if (currentState === STATE_WAITING)
        setState(STATE_CONNECTED);
      if (guac_client.onsync)
        guac_client.onsync(timestamp);
    },
    "transfer": function(parameters) {
      var srcL = getLayer(parseInt(parameters[0]));
      var srcX = parseInt(parameters[1]);
      var srcY = parseInt(parameters[2]);
      var srcWidth = parseInt(parameters[3]);
      var srcHeight = parseInt(parameters[4]);
      var function_index = parseInt(parameters[5]);
      var dstL = getLayer(parseInt(parameters[6]));
      var dstX = parseInt(parameters[7]);
      var dstY = parseInt(parameters[8]);
      if (function_index === 3)
        display.put(
          srcL,
          srcX,
          srcY,
          srcWidth,
          srcHeight,
          dstL,
          dstX,
          dstY
        );
      else if (function_index !== 5)
        display.transfer(
          srcL,
          srcX,
          srcY,
          srcWidth,
          srcHeight,
          dstL,
          dstX,
          dstY,
          Guacamole.Client.DefaultTransferFunction[function_index]
        );
    },
    "transform": function(parameters) {
      var layer = getLayer(parseInt(parameters[0]));
      var a = parseFloat(parameters[1]);
      var b = parseFloat(parameters[2]);
      var c = parseFloat(parameters[3]);
      var d = parseFloat(parameters[4]);
      var e = parseFloat(parameters[5]);
      var f = parseFloat(parameters[6]);
      display.transform(layer, a, b, c, d, e, f);
    },
    "undefine": function handleUndefine(parameters) {
      var objectIndex = parseInt(parameters[0]);
      var object = objects[objectIndex];
      if (object && object.onundefine)
        object.onundefine();
    },
    "video": function(parameters) {
      var stream_index = parseInt(parameters[0]);
      var layer = getLayer(parseInt(parameters[1]));
      var mimetype = parameters[2];
      var stream = streams[stream_index] = new Guacamole.InputStream(guac_client, stream_index);
      var videoPlayer = null;
      if (guac_client.onvideo)
        videoPlayer = guac_client.onvideo(stream, layer, mimetype);
      if (!videoPlayer)
        videoPlayer = Guacamole.VideoPlayer.getInstance(stream, layer, mimetype);
      if (videoPlayer) {
        videoPlayers[stream_index] = videoPlayer;
        guac_client.sendAck(stream_index, "OK", 0);
      } else
        guac_client.sendAck(stream_index, "BAD TYPE", 783);
    }
  };
  var sendKeepAlive = function sendKeepAlive2() {
    tunnel.sendMessage("nop");
    lastSentKeepAlive = (/* @__PURE__ */ new Date()).getTime();
  };
  var scheduleKeepAlive = function scheduleKeepAlive2() {
    globalThis.clearTimeout(keepAliveTimeout);
    var currentTime = (/* @__PURE__ */ new Date()).getTime();
    var keepAliveDelay = Math.max(lastSentKeepAlive + KEEP_ALIVE_FREQUENCY - currentTime, 0);
    if (keepAliveDelay > 0)
      keepAliveTimeout = globalThis.setTimeout(sendKeepAlive, keepAliveDelay);
    else
      sendKeepAlive();
  };
  var stopKeepAlive = function stopKeepAlive2() {
    globalThis.clearTimeout(keepAliveTimeout);
  };
  tunnel.oninstruction = function(opcode, parameters) {
    var handler = instructionHandlers[opcode];
    if (handler)
      handler(parameters);
    scheduleKeepAlive();
  };
  this.disconnect = function() {
    if (currentState != STATE_DISCONNECTED && currentState != STATE_DISCONNECTING) {
      setState(STATE_DISCONNECTING);
      stopKeepAlive();
      tunnel.sendMessage("disconnect");
      tunnel.disconnect();
      setState(STATE_DISCONNECTED);
    }
  };
  this.connect = function(data) {
    setState(STATE_CONNECTING);
    try {
      tunnel.connect(data);
    } catch (status) {
      setState(STATE_IDLE);
      throw status;
    }
    scheduleKeepAlive();
    setState(STATE_WAITING);
  };
};
Guacamole.Client.DefaultTransferFunction = {
  /* BLACK */
  0: function(src, dst) {
    dst.red = dst.green = dst.blue = 0;
  },
  /* WHITE */
  15: function(src, dst) {
    dst.red = dst.green = dst.blue = 255;
  },
  /* SRC */
  3: function(src, dst) {
    dst.red = src.red;
    dst.green = src.green;
    dst.blue = src.blue;
    dst.alpha = src.alpha;
  },
  /* DEST (no-op) */
  5: function(src, dst) {
  },
  /* Invert SRC */
  12: function(src, dst) {
    dst.red = 255 & ~src.red;
    dst.green = 255 & ~src.green;
    dst.blue = 255 & ~src.blue;
    dst.alpha = src.alpha;
  },
  /* Invert DEST */
  10: function(src, dst) {
    dst.red = 255 & ~dst.red;
    dst.green = 255 & ~dst.green;
    dst.blue = 255 & ~dst.blue;
  },
  /* AND */
  1: function(src, dst) {
    dst.red = src.red & dst.red;
    dst.green = src.green & dst.green;
    dst.blue = src.blue & dst.blue;
  },
  /* NAND */
  14: function(src, dst) {
    dst.red = 255 & ~(src.red & dst.red);
    dst.green = 255 & ~(src.green & dst.green);
    dst.blue = 255 & ~(src.blue & dst.blue);
  },
  /* OR */
  7: function(src, dst) {
    dst.red = src.red | dst.red;
    dst.green = src.green | dst.green;
    dst.blue = src.blue | dst.blue;
  },
  /* NOR */
  8: function(src, dst) {
    dst.red = 255 & ~(src.red | dst.red);
    dst.green = 255 & ~(src.green | dst.green);
    dst.blue = 255 & ~(src.blue | dst.blue);
  },
  /* XOR */
  6: function(src, dst) {
    dst.red = src.red ^ dst.red;
    dst.green = src.green ^ dst.green;
    dst.blue = src.blue ^ dst.blue;
  },
  /* XNOR */
  9: function(src, dst) {
    dst.red = 255 & ~(src.red ^ dst.red);
    dst.green = 255 & ~(src.green ^ dst.green);
    dst.blue = 255 & ~(src.blue ^ dst.blue);
  },
  /* AND inverted source */
  4: function(src, dst) {
    dst.red = 255 & (~src.red & dst.red);
    dst.green = 255 & (~src.green & dst.green);
    dst.blue = 255 & (~src.blue & dst.blue);
  },
  /* OR inverted source */
  13: function(src, dst) {
    dst.red = 255 & (~src.red | dst.red);
    dst.green = 255 & (~src.green | dst.green);
    dst.blue = 255 & (~src.blue | dst.blue);
  },
  /* AND inverted destination */
  2: function(src, dst) {
    dst.red = 255 & (src.red & ~dst.red);
    dst.green = 255 & (src.green & ~dst.green);
    dst.blue = 255 & (src.blue & ~dst.blue);
  },
  /* OR inverted destination */
  11: function(src, dst) {
    dst.red = 255 & (src.red | ~dst.red);
    dst.green = 255 & (src.green | ~dst.green);
    dst.blue = 255 & (src.blue | ~dst.blue);
  }
};
Guacamole.Client.Message = {
  /**
   * A client message that indicates that a user has joined an existing
   * connection. This message expects a single additional argument - the
   * name of the user who has joined the connection.
   * 
   * @type {!number}
   */
  "USER_JOINED": 1,
  /**
   * A client message that indicates that a user has left an existing
   * connection. This message expects a single additional argument - the
   * name of the user who has left the connection.
   * 
   * @type {!number}
   */
  "USER_LEFT": 2
};
var Guacamole = Guacamole || {};
Guacamole.DataURIReader = function(stream, mimetype) {
  var guac_reader = this;
  var uri = "data:" + mimetype + ";base64,";
  stream.onblob = function dataURIReaderBlob(data) {
    uri += data;
  };
  stream.onend = function dataURIReaderEnd() {
    if (guac_reader.onend)
      guac_reader.onend();
  };
  this.getURI = function getURI() {
    return uri;
  };
  this.onend = null;
};
var Guacamole = Guacamole || {};
Guacamole.Display = function() {
  var guac_display = this;
  var displayWidth = 0;
  var displayHeight = 0;
  var displayScale = 1;
  var display = document.createElement("div");
  display.style.position = "relative";
  display.style.width = displayWidth + "px";
  display.style.height = displayHeight + "px";
  display.style.transformOrigin = display.style.webkitTransformOrigin = display.style.MozTransformOrigin = display.style.OTransformOrigin = display.style.msTransformOrigin = "0 0";
  var default_layer = new Guacamole.Display.VisibleLayer(displayWidth, displayHeight);
  var cursor = new Guacamole.Display.VisibleLayer(0, 0);
  cursor.setChannelMask(Guacamole.Layer.SRC);
  display.appendChild(default_layer.getElement());
  display.appendChild(cursor.getElement());
  var bounds = document.createElement("div");
  bounds.style.position = "relative";
  bounds.style.width = displayWidth * displayScale + "px";
  bounds.style.height = displayHeight * displayScale + "px";
  bounds.appendChild(display);
  this.cursorHotspotX = 0;
  this.cursorHotspotY = 0;
  this.cursorX = 0;
  this.cursorY = 0;
  this.onresize = null;
  this.oncursor = null;
  var tasks = [];
  var frames = [];
  function __flush_frames() {
    var rendered_frames = 0;
    while (rendered_frames < frames.length) {
      var frame = frames[rendered_frames];
      if (!frame.isReady())
        break;
      frame.flush();
      rendered_frames++;
    }
    frames.splice(0, rendered_frames);
  }
  function Frame(callback, tasks2) {
    this.cancel = function cancel() {
      callback = null;
      tasks2.forEach(function cancelTask(task) {
        task.cancel();
      });
      tasks2 = [];
    };
    this.isReady = function() {
      for (var i = 0; i < tasks2.length; i++) {
        if (tasks2[i].blocked)
          return false;
      }
      return true;
    };
    this.flush = function() {
      for (var i = 0; i < tasks2.length; i++)
        tasks2[i].execute();
      if (callback) callback();
    };
  }
  function Task(taskHandler, blocked) {
    var task = this;
    this.blocked = blocked;
    this.cancel = function cancel() {
      task.blocked = false;
      taskHandler = null;
    };
    this.unblock = function() {
      if (task.blocked) {
        task.blocked = false;
        __flush_frames();
      }
    };
    this.execute = function() {
      if (taskHandler) taskHandler();
    };
  }
  function scheduleTask(handler, blocked) {
    var task = new Task(handler, blocked);
    tasks.push(task);
    return task;
  }
  this.getElement = function() {
    return bounds;
  };
  this.getWidth = function() {
    return displayWidth;
  };
  this.getHeight = function() {
    return displayHeight;
  };
  this.getDefaultLayer = function() {
    return default_layer;
  };
  this.getCursorLayer = function() {
    return cursor;
  };
  this.createLayer = function() {
    var layer = new Guacamole.Display.VisibleLayer(displayWidth, displayHeight);
    layer.move(default_layer, 0, 0, 0);
    return layer;
  };
  this.createBuffer = function() {
    var buffer = new Guacamole.Layer(0, 0);
    buffer.autosize = 1;
    return buffer;
  };
  this.flush = function(callback) {
    frames.push(new Frame(callback, tasks));
    tasks = [];
    __flush_frames();
  };
  this.cancel = function cancel() {
    frames.forEach(function cancelFrame(frame) {
      frame.cancel();
    });
    frames = [];
    tasks.forEach(function cancelTask(task) {
      task.cancel();
    });
    tasks = [];
  };
  this.setCursor = function(hotspotX, hotspotY, layer, srcx, srcy, srcw, srch) {
    scheduleTask(function __display_set_cursor() {
      guac_display.cursorHotspotX = hotspotX;
      guac_display.cursorHotspotY = hotspotY;
      cursor.resize(srcw, srch);
      cursor.copy(layer, srcx, srcy, srcw, srch, 0, 0);
      guac_display.moveCursor(guac_display.cursorX, guac_display.cursorY);
      if (guac_display.oncursor)
        guac_display.oncursor(cursor.toCanvas(), hotspotX, hotspotY);
    });
  };
  this.showCursor = function(shown) {
    var element = cursor.getElement();
    var parent = element.parentNode;
    if (shown === false) {
      if (parent)
        parent.removeChild(element);
    } else if (parent !== display)
      display.appendChild(element);
  };
  this.moveCursor = function(x, y) {
    cursor.translate(
      x - guac_display.cursorHotspotX,
      y - guac_display.cursorHotspotY
    );
    guac_display.cursorX = x;
    guac_display.cursorY = y;
  };
  this.resize = function(layer, width, height) {
    scheduleTask(function __display_resize() {
      layer.resize(width, height);
      if (layer === default_layer) {
        displayWidth = width;
        displayHeight = height;
        display.style.width = displayWidth + "px";
        display.style.height = displayHeight + "px";
        bounds.style.width = displayWidth * displayScale + "px";
        bounds.style.height = displayHeight * displayScale + "px";
        if (guac_display.onresize)
          guac_display.onresize(width, height);
      }
    });
  };
  this.drawImage = function(layer, x, y, image) {
    scheduleTask(function __display_drawImage() {
      layer.drawImage(x, y, image);
    });
  };
  this.drawBlob = function(layer, x, y, blob) {
    var task;
    if (globalThis.createImageBitmap) {
      var bitmap;
      task = scheduleTask(function drawImageBitmap() {
        layer.drawImage(x, y, bitmap);
      }, true);
      globalThis.createImageBitmap(blob).then(function bitmapLoaded(decoded) {
        bitmap = decoded;
        task.unblock();
      });
    } else {
      var url = URL.createObjectURL(blob);
      task = scheduleTask(function __display_drawBlob() {
        if (image.width && image.height)
          layer.drawImage(x, y, image);
        URL.revokeObjectURL(url);
      }, true);
      var image = new Image();
      image.onload = task.unblock;
      image.onerror = task.unblock;
      image.src = url;
    }
  };
  this.drawStream = function drawStream(layer, x, y, stream, mimetype) {
    if (globalThis.createImageBitmap) {
      var reader = new Guacamole.BlobReader(stream, mimetype);
      reader.onend = function drawImageBlob() {
        guac_display.drawBlob(layer, x, y, reader.getBlob());
      };
    } else {
      var reader = new Guacamole.DataURIReader(stream, mimetype);
      reader.onend = function drawImageDataURI() {
        guac_display.draw(layer, x, y, reader.getURI());
      };
    }
  };
  this.draw = function(layer, x, y, url) {
    var task = scheduleTask(function __display_draw() {
      if (image.width && image.height)
        layer.drawImage(x, y, image);
    }, true);
    var image = new Image();
    image.onload = task.unblock;
    image.onerror = task.unblock;
    image.src = url;
  };
  this.play = function(layer, mimetype, duration, url) {
    var video = document.createElement("video");
    video.type = mimetype;
    video.src = url;
    video.addEventListener("play", function() {
      function render_callback() {
        layer.drawImage(0, 0, video);
        if (!video.ended)
          globalThis.setTimeout(render_callback, 20);
      }
      render_callback();
    }, false);
    scheduleTask(video.play);
  };
  this.transfer = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y, transferFunction) {
    scheduleTask(function __display_transfer() {
      dstLayer.transfer(srcLayer, srcx, srcy, srcw, srch, x, y, transferFunction);
    });
  };
  this.put = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y) {
    scheduleTask(function __display_put() {
      dstLayer.put(srcLayer, srcx, srcy, srcw, srch, x, y);
    });
  };
  this.copy = function(srcLayer, srcx, srcy, srcw, srch, dstLayer, x, y) {
    scheduleTask(function __display_copy() {
      dstLayer.copy(srcLayer, srcx, srcy, srcw, srch, x, y);
    });
  };
  this.moveTo = function(layer, x, y) {
    scheduleTask(function __display_moveTo() {
      layer.moveTo(x, y);
    });
  };
  this.lineTo = function(layer, x, y) {
    scheduleTask(function __display_lineTo() {
      layer.lineTo(x, y);
    });
  };
  this.arc = function(layer, x, y, radius, startAngle, endAngle, negative) {
    scheduleTask(function __display_arc() {
      layer.arc(x, y, radius, startAngle, endAngle, negative);
    });
  };
  this.curveTo = function(layer, cp1x, cp1y, cp2x, cp2y, x, y) {
    scheduleTask(function __display_curveTo() {
      layer.curveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    });
  };
  this.close = function(layer) {
    scheduleTask(function __display_close() {
      layer.close();
    });
  };
  this.rect = function(layer, x, y, w, h) {
    scheduleTask(function __display_rect() {
      layer.rect(x, y, w, h);
    });
  };
  this.clip = function(layer) {
    scheduleTask(function __display_clip() {
      layer.clip();
    });
  };
  this.strokeColor = function(layer, cap, join, thickness, r, g, b, a) {
    scheduleTask(function __display_strokeColor() {
      layer.strokeColor(cap, join, thickness, r, g, b, a);
    });
  };
  this.fillColor = function(layer, r, g, b, a) {
    scheduleTask(function __display_fillColor() {
      layer.fillColor(r, g, b, a);
    });
  };
  this.strokeLayer = function(layer, cap, join, thickness, srcLayer) {
    scheduleTask(function __display_strokeLayer() {
      layer.strokeLayer(cap, join, thickness, srcLayer);
    });
  };
  this.fillLayer = function(layer, srcLayer) {
    scheduleTask(function __display_fillLayer() {
      layer.fillLayer(srcLayer);
    });
  };
  this.push = function(layer) {
    scheduleTask(function __display_push() {
      layer.push();
    });
  };
  this.pop = function(layer) {
    scheduleTask(function __display_pop() {
      layer.pop();
    });
  };
  this.reset = function(layer) {
    scheduleTask(function __display_reset() {
      layer.reset();
    });
  };
  this.setTransform = function(layer, a, b, c, d, e, f) {
    scheduleTask(function __display_setTransform() {
      layer.setTransform(a, b, c, d, e, f);
    });
  };
  this.transform = function(layer, a, b, c, d, e, f) {
    scheduleTask(function __display_transform() {
      layer.transform(a, b, c, d, e, f);
    });
  };
  this.setChannelMask = function(layer, mask) {
    scheduleTask(function __display_setChannelMask() {
      layer.setChannelMask(mask);
    });
  };
  this.setMiterLimit = function(layer, limit) {
    scheduleTask(function __display_setMiterLimit() {
      layer.setMiterLimit(limit);
    });
  };
  this.dispose = function dispose(layer) {
    scheduleTask(function disposeLayer() {
      layer.dispose();
    });
  };
  this.distort = function distort(layer, a, b, c, d, e, f) {
    scheduleTask(function distortLayer() {
      layer.distort(a, b, c, d, e, f);
    });
  };
  this.move = function move(layer, parent, x, y, z) {
    scheduleTask(function moveLayer() {
      layer.move(parent, x, y, z);
    });
  };
  this.shade = function shade(layer, alpha) {
    scheduleTask(function shadeLayer() {
      layer.shade(alpha);
    });
  };
  this.scale = function(scale) {
    display.style.transform = display.style.WebkitTransform = display.style.MozTransform = display.style.OTransform = display.style.msTransform = "scale(" + scale + "," + scale + ")";
    displayScale = scale;
    bounds.style.width = displayWidth * displayScale + "px";
    bounds.style.height = displayHeight * displayScale + "px";
  };
  this.getScale = function() {
    return displayScale;
  };
  this.flatten = function() {
    var canvas = document.createElement("canvas");
    canvas.width = default_layer.width;
    canvas.height = default_layer.height;
    var context = canvas.getContext("2d");
    function get_children(layer) {
      var children = [];
      for (var index in layer.children)
        children.push(layer.children[index]);
      children.sort(function children_comparator(a, b) {
        var diff = a.z - b.z;
        if (diff !== 0)
          return diff;
        var a_element = a.getElement();
        var b_element = b.getElement();
        var position = b_element.compareDocumentPosition(a_element);
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return -1;
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
        return 0;
      });
      return children;
    }
    function draw_layer(layer, x, y) {
      if (layer.width > 0 && layer.height > 0) {
        var initial_alpha = context.globalAlpha;
        context.globalAlpha *= layer.alpha / 255;
        context.drawImage(layer.getCanvas(), x, y);
        var children = get_children(layer);
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          draw_layer(child, x + child.x, y + child.y);
        }
        context.globalAlpha = initial_alpha;
      }
    }
    draw_layer(default_layer, 0, 0);
    return canvas;
  };
};
Guacamole.Display.VisibleLayer = function(width, height) {
  Guacamole.Layer.apply(this, [width, height]);
  var layer = this;
  this.__unique_id = Guacamole.Display.VisibleLayer.__next_id++;
  this.alpha = 255;
  this.x = 0;
  this.y = 0;
  this.z = 0;
  this.matrix = [1, 0, 0, 1, 0, 0];
  this.parent = null;
  this.children = {};
  var canvas = layer.getCanvas();
  canvas.style.position = "absolute";
  canvas.style.left = "0px";
  canvas.style.top = "0px";
  var div = document.createElement("div");
  div.appendChild(canvas);
  div.style.width = width + "px";
  div.style.height = height + "px";
  div.style.position = "absolute";
  div.style.left = "0px";
  div.style.top = "0px";
  div.style.overflow = "hidden";
  var __super_resize = this.resize;
  this.resize = function(width2, height2) {
    div.style.width = width2 + "px";
    div.style.height = height2 + "px";
    __super_resize(width2, height2);
  };
  this.getElement = function() {
    return div;
  };
  var translate = "translate(0px, 0px)";
  var matrix = "matrix(1, 0, 0, 1, 0, 0)";
  this.translate = function(x, y) {
    layer.x = x;
    layer.y = y;
    translate = "translate(" + x + "px," + y + "px)";
    div.style.transform = div.style.WebkitTransform = div.style.MozTransform = div.style.OTransform = div.style.msTransform = translate + " " + matrix;
  };
  this.move = function(parent, x, y, z) {
    if (layer.parent !== parent) {
      if (layer.parent)
        delete layer.parent.children[layer.__unique_id];
      layer.parent = parent;
      parent.children[layer.__unique_id] = layer;
      var parent_element = parent.getElement();
      parent_element.appendChild(div);
    }
    layer.translate(x, y);
    layer.z = z;
    div.style.zIndex = z;
  };
  this.shade = function(a) {
    layer.alpha = a;
    div.style.opacity = a / 255;
  };
  this.dispose = function() {
    if (layer.parent) {
      delete layer.parent.children[layer.__unique_id];
      layer.parent = null;
    }
    if (div.parentNode)
      div.parentNode.removeChild(div);
  };
  this.distort = function(a, b, c, d, e, f) {
    layer.matrix = [a, b, c, d, e, f];
    matrix = /* a c e
     * b d f
     * 0 0 1
     */
    "matrix(" + a + "," + b + "," + c + "," + d + "," + e + "," + f + ")";
    div.style.transform = div.style.WebkitTransform = div.style.MozTransform = div.style.OTransform = div.style.msTransform = translate + " " + matrix;
  };
};
Guacamole.Display.VisibleLayer.__next_id = 0;
var Guacamole = Guacamole || {};
Guacamole.Event = function Event(type) {
  this.type = type;
  this.timestamp = (/* @__PURE__ */ new Date()).getTime();
  this.getAge = function getAge() {
    return (/* @__PURE__ */ new Date()).getTime() - this.timestamp;
  };
  this.invokeLegacyHandler = function invokeLegacyHandler(eventTarget) {
  };
};
Guacamole.Event.DOMEvent = function DOMEvent(type, events) {
  Guacamole.Event.call(this, type);
  events = events || [];
  if (!Array.isArray(events))
    events = [events];
  this.preventDefault = function preventDefault() {
    events.forEach(function applyPreventDefault(event) {
      if (event.preventDefault) event.preventDefault();
      event.returnValue = false;
    });
  };
  this.stopPropagation = function stopPropagation() {
    events.forEach(function applyStopPropagation(event) {
      event.stopPropagation();
    });
  };
};
Guacamole.Event.DOMEvent.cancelEvent = function cancelEvent(event) {
  event.stopPropagation();
  if (event.preventDefault) event.preventDefault();
  event.returnValue = false;
};
Guacamole.Event.Target = function Target() {
  var listeners = {};
  this.on = function on(type, listener) {
    var relevantListeners = listeners[type];
    if (!relevantListeners)
      listeners[type] = relevantListeners = [];
    relevantListeners.push(listener);
  };
  this.onEach = function onEach(types, listener) {
    types.forEach(function addListener(type) {
      this.on(type, listener);
    }, this);
  };
  this.dispatch = function dispatch(event) {
    event.invokeLegacyHandler(this);
    var relevantListeners = listeners[event.type];
    if (relevantListeners) {
      for (var i = 0; i < relevantListeners.length; i++) {
        relevantListeners[i](event, this);
      }
    }
  };
  this.off = function off(type, listener) {
    var relevantListeners = listeners[type];
    if (!relevantListeners)
      return false;
    for (var i = 0; i < relevantListeners.length; i++) {
      if (relevantListeners[i] === listener) {
        relevantListeners.splice(i, 1);
        return true;
      }
    }
    return false;
  };
  this.offEach = function offEach(types, listener) {
    var changed = false;
    types.forEach(function removeListener(type) {
      changed |= this.off(type, listener);
    }, this);
    return changed;
  };
};
var Guacamole = Guacamole || {};
Guacamole.InputSink = function InputSink() {
  var sink = this;
  var field = document.createElement("textarea");
  field.style.position = "fixed";
  field.style.outline = "none";
  field.style.border = "none";
  field.style.margin = "0";
  field.style.padding = "0";
  field.style.height = "0";
  field.style.width = "0";
  field.style.left = "0";
  field.style.bottom = "0";
  field.style.resize = "none";
  field.style.background = "transparent";
  field.style.color = "transparent";
  field.addEventListener("keypress", function clearKeypress(e) {
    field.value = "";
  }, false);
  field.addEventListener("compositionend", function clearCompletedComposition(e) {
    if (e.data)
      field.value = "";
  }, false);
  field.addEventListener("input", function clearCompletedInput(e) {
    if (e.data && !e.isComposing)
      field.value = "";
  }, false);
  field.addEventListener("focus", function focusReceived() {
    globalThis.setTimeout(function deferRefocus() {
      field.click();
      field.select();
    }, 0);
  }, true);
  this.focus = function focus() {
    globalThis.setTimeout(function deferRefocus() {
      field.focus();
    }, 0);
  };
  this.getElement = function getElement() {
    return field;
  };
  document.addEventListener("keydown", function refocusSink(e) {
    var focused = document.activeElement;
    if (focused && focused !== document.body) {
      var rect = focused.getBoundingClientRect();
      if (rect.left + rect.width > 0 && rect.top + rect.height > 0)
        return;
    }
    sink.focus();
  }, true);
};
var Guacamole = Guacamole || {};
Guacamole.InputStream = function(client, index) {
  var guac_stream = this;
  this.index = index;
  this.onblob = null;
  this.onend = null;
  this.sendAck = function(message, code) {
    client.sendAck(guac_stream.index, message, code);
  };
};
var Guacamole = Guacamole || {};
Guacamole.IntegerPool = function() {
  var guac_pool = this;
  var pool = [];
  this.next_int = 0;
  this.next = function() {
    if (pool.length > 0)
      return pool.shift();
    return guac_pool.next_int++;
  };
  this.free = function(integer) {
    pool.push(integer);
  };
};
var Guacamole = Guacamole || {};
Guacamole.JSONReader = function guacamoleJSONReader(stream) {
  var guacReader = this;
  var stringReader = new Guacamole.StringReader(stream);
  var json = "";
  this.getLength = function getLength() {
    return json.length;
  };
  this.getJSON = function getJSON() {
    return JSON.parse(json);
  };
  stringReader.ontext = function ontext(text) {
    json += text;
    if (guacReader.onprogress)
      guacReader.onprogress(text.length);
  };
  stringReader.onend = function onend() {
    if (guacReader.onend)
      guacReader.onend();
  };
  this.onprogress = null;
  this.onend = null;
};
var Guacamole = Guacamole || {};
Guacamole.Keyboard = function Keyboard(element) {
  var guac_keyboard = this;
  var guacKeyboardID = Guacamole.Keyboard._nextID++;
  var EVENT_MARKER = "_GUAC_KEYBOARD_HANDLED_BY_" + guacKeyboardID;
  this.onkeydown = null;
  this.onkeyup = null;
  var quirks = {
    /**
     * Whether keyup events are universally unreliable.
     *
     * @type {!boolean}
     */
    keyupUnreliable: false,
    /**
     * Whether the Alt key is actually a modifier for typable keys and is
     * thus never used for keyboard shortcuts.
     *
     * @type {!boolean}
     */
    altIsTypableOnly: false,
    /**
     * Whether we can rely on receiving a keyup event for the Caps Lock
     * key.
     *
     * @type {!boolean}
     */
    capsLockKeyupUnreliable: false
  };
  if (navigator && navigator.platform) {
    if (navigator.platform.match(/ipad|iphone|ipod/i))
      quirks.keyupUnreliable = true;
    else if (navigator.platform.match(/^mac/i)) {
      quirks.altIsTypableOnly = true;
      quirks.capsLockKeyupUnreliable = true;
    }
  }
  var KeyEvent = function KeyEvent2(orig) {
    var key_event = this;
    this.keyCode = orig ? orig.which || orig.keyCode : 0;
    this.keyIdentifier = orig && orig.keyIdentifier;
    this.key = orig && orig.key;
    this.location = orig ? getEventLocation(orig) : 0;
    this.modifiers = orig ? Guacamole.Keyboard.ModifierState.fromKeyboardEvent(orig) : new Guacamole.Keyboard.ModifierState();
    this.timestamp = (/* @__PURE__ */ new Date()).getTime();
    this.defaultPrevented = false;
    this.keysym = null;
    this.reliable = false;
    this.getAge = function() {
      return (/* @__PURE__ */ new Date()).getTime() - key_event.timestamp;
    };
  };
  var KeydownEvent = function KeydownEvent2(orig) {
    KeyEvent.call(this, orig);
    this.keysym = keysym_from_key_identifier(this.key, this.location) || keysym_from_keycode(this.keyCode, this.location);
    this.keyupReliable = !quirks.keyupUnreliable;
    if (this.keysym && !isPrintable(this.keysym))
      this.reliable = true;
    if (!this.keysym && key_identifier_sane(this.keyCode, this.keyIdentifier))
      this.keysym = keysym_from_key_identifier(this.keyIdentifier, this.location, this.modifiers.shift);
    if (this.modifiers.meta && this.keysym !== 65511 && this.keysym !== 65512)
      this.keyupReliable = false;
    else if (this.keysym === 65509 && quirks.capsLockKeyupUnreliable)
      this.keyupReliable = false;
    var prevent_alt = !this.modifiers.ctrl && !quirks.altIsTypableOnly;
    var prevent_ctrl = !this.modifiers.alt;
    if (prevent_ctrl && this.modifiers.ctrl || prevent_alt && this.modifiers.alt || this.modifiers.meta || this.modifiers.hyper)
      this.reliable = true;
    recentKeysym[this.keyCode] = this.keysym;
  };
  KeydownEvent.prototype = new KeyEvent();
  var KeypressEvent = function KeypressEvent2(orig) {
    KeyEvent.call(this, orig);
    this.keysym = keysym_from_charcode(this.keyCode);
    this.reliable = true;
  };
  KeypressEvent.prototype = new KeyEvent();
  var KeyupEvent = function KeyupEvent2(orig) {
    KeyEvent.call(this, orig);
    this.keysym = keysym_from_keycode(this.keyCode, this.location) || keysym_from_key_identifier(this.key, this.location);
    if (!guac_keyboard.pressed[this.keysym])
      this.keysym = recentKeysym[this.keyCode] || this.keysym;
    this.reliable = true;
  };
  KeyupEvent.prototype = new KeyEvent();
  var eventLog = [];
  var keycodeKeysyms = {
    8: [65288],
    // backspace
    9: [65289],
    // tab
    12: [65291, 65291, 65291, 65461],
    // clear       / KP 5
    13: [65293],
    // enter
    16: [65505, 65505, 65506],
    // shift
    17: [65507, 65507, 65508],
    // ctrl
    18: [65513, 65513, 65027],
    // alt
    19: [65299],
    // pause/break
    20: [65509],
    // caps lock
    27: [65307],
    // escape
    32: [32],
    // space
    33: [65365, 65365, 65365, 65465],
    // page up     / KP 9
    34: [65366, 65366, 65366, 65459],
    // page down   / KP 3
    35: [65367, 65367, 65367, 65457],
    // end         / KP 1
    36: [65360, 65360, 65360, 65463],
    // home        / KP 7
    37: [65361, 65361, 65361, 65460],
    // left arrow  / KP 4
    38: [65362, 65362, 65362, 65464],
    // up arrow    / KP 8
    39: [65363, 65363, 65363, 65462],
    // right arrow / KP 6
    40: [65364, 65364, 65364, 65458],
    // down arrow  / KP 2
    45: [65379, 65379, 65379, 65456],
    // insert      / KP 0
    46: [65535, 65535, 65535, 65454],
    // delete      / KP decimal
    91: [65511],
    // left windows/command key (meta_l)
    92: [65512],
    // right window/command key (meta_r)
    93: [65383],
    // menu key
    96: [65456],
    // KP 0
    97: [65457],
    // KP 1
    98: [65458],
    // KP 2
    99: [65459],
    // KP 3
    100: [65460],
    // KP 4
    101: [65461],
    // KP 5
    102: [65462],
    // KP 6
    103: [65463],
    // KP 7
    104: [65464],
    // KP 8
    105: [65465],
    // KP 9
    106: [65450],
    // KP multiply
    107: [65451],
    // KP add
    109: [65453],
    // KP subtract
    110: [65454],
    // KP decimal
    111: [65455],
    // KP divide
    112: [65470],
    // f1
    113: [65471],
    // f2
    114: [65472],
    // f3
    115: [65473],
    // f4
    116: [65474],
    // f5
    117: [65475],
    // f6
    118: [65476],
    // f7
    119: [65477],
    // f8
    120: [65478],
    // f9
    121: [65479],
    // f10
    122: [65480],
    // f11
    123: [65481],
    // f12
    144: [65407],
    // num lock
    145: [65300],
    // scroll lock
    225: [65027]
    // altgraph (iso_level3_shift)
  };
  var keyidentifier_keysym = {
    "Again": [65382],
    "AllCandidates": [65341],
    "Alphanumeric": [65328],
    "Alt": [65513, 65513, 65027],
    "Attn": [64782],
    "AltGraph": [65027],
    "ArrowDown": [65364],
    "ArrowLeft": [65361],
    "ArrowRight": [65363],
    "ArrowUp": [65362],
    "Backspace": [65288],
    "CapsLock": [65509],
    "Cancel": [65385],
    "Clear": [65291],
    "Convert": [65313],
    "Copy": [64789],
    "Crsel": [64796],
    "CrSel": [64796],
    "CodeInput": [65335],
    "Compose": [65312],
    "Control": [65507, 65507, 65508],
    "ContextMenu": [65383],
    "Delete": [65535],
    "Down": [65364],
    "End": [65367],
    "Enter": [65293],
    "EraseEof": [64774],
    "Escape": [65307],
    "Execute": [65378],
    "Exsel": [64797],
    "ExSel": [64797],
    "F1": [65470],
    "F2": [65471],
    "F3": [65472],
    "F4": [65473],
    "F5": [65474],
    "F6": [65475],
    "F7": [65476],
    "F8": [65477],
    "F9": [65478],
    "F10": [65479],
    "F11": [65480],
    "F12": [65481],
    "F13": [65482],
    "F14": [65483],
    "F15": [65484],
    "F16": [65485],
    "F17": [65486],
    "F18": [65487],
    "F19": [65488],
    "F20": [65489],
    "F21": [65490],
    "F22": [65491],
    "F23": [65492],
    "F24": [65493],
    "Find": [65384],
    "GroupFirst": [65036],
    "GroupLast": [65038],
    "GroupNext": [65032],
    "GroupPrevious": [65034],
    "FullWidth": null,
    "HalfWidth": null,
    "HangulMode": [65329],
    "Hankaku": [65321],
    "HanjaMode": [65332],
    "Help": [65386],
    "Hiragana": [65317],
    "HiraganaKatakana": [65319],
    "Home": [65360],
    "Hyper": [65517, 65517, 65518],
    "Insert": [65379],
    "JapaneseHiragana": [65317],
    "JapaneseKatakana": [65318],
    "JapaneseRomaji": [65316],
    "JunjaMode": [65336],
    "KanaMode": [65325],
    "KanjiMode": [65313],
    "Katakana": [65318],
    "Left": [65361],
    "Meta": [65511, 65511, 65512],
    "ModeChange": [65406],
    "NumLock": [65407],
    "PageDown": [65366],
    "PageUp": [65365],
    "Pause": [65299],
    "Play": [64790],
    "PreviousCandidate": [65342],
    "PrintScreen": [65377],
    "Redo": [65382],
    "Right": [65363],
    "RomanCharacters": null,
    "Scroll": [65300],
    "Select": [65376],
    "Separator": [65452],
    "Shift": [65505, 65505, 65506],
    "SingleCandidate": [65340],
    "Super": [65515, 65515, 65516],
    "Tab": [65289],
    "UIKeyInputDownArrow": [65364],
    "UIKeyInputEscape": [65307],
    "UIKeyInputLeftArrow": [65361],
    "UIKeyInputRightArrow": [65363],
    "UIKeyInputUpArrow": [65362],
    "Up": [65362],
    "Undo": [65381],
    "Win": [65511, 65511, 65512],
    "Zenkaku": [65320],
    "ZenkakuHankaku": [65322]
  };
  var no_repeat = {
    65027: true,
    // ISO Level 3 Shift (AltGr)
    65505: true,
    // Left shift
    65506: true,
    // Right shift
    65507: true,
    // Left ctrl 
    65508: true,
    // Right ctrl 
    65509: true,
    // Caps Lock
    65511: true,
    // Left meta 
    65512: true,
    // Right meta 
    65513: true,
    // Left alt
    65514: true,
    // Right alt
    65515: true,
    // Left super/hyper
    65516: true
    // Right super/hyper
  };
  this.modifiers = new Guacamole.Keyboard.ModifierState();
  this.pressed = {};
  var implicitlyPressed = {};
  var last_keydown_result = {};
  var recentKeysym = {};
  var key_repeat_timeout = null;
  var key_repeat_interval = null;
  var get_keysym = function get_keysym2(keysyms, location) {
    if (!keysyms)
      return null;
    return keysyms[location] || keysyms[0];
  };
  var isPrintable = function isPrintable2(keysym) {
    return keysym >= 0 && keysym <= 255 || (keysym & 4294901760) === 16777216;
  };
  function keysym_from_key_identifier(identifier, location, shifted) {
    if (!identifier)
      return null;
    var typedCharacter;
    var unicodePrefixLocation = identifier.indexOf("U+");
    if (unicodePrefixLocation >= 0) {
      var hex = identifier.substring(unicodePrefixLocation + 2);
      typedCharacter = String.fromCharCode(parseInt(hex, 16));
    } else if (identifier.length === 1 && location !== 3)
      typedCharacter = identifier;
    else
      return get_keysym(keyidentifier_keysym[identifier], location);
    if (shifted === true)
      typedCharacter = typedCharacter.toUpperCase();
    else if (shifted === false)
      typedCharacter = typedCharacter.toLowerCase();
    var codepoint = typedCharacter.charCodeAt(0);
    return keysym_from_charcode(codepoint);
  }
  function isControlCharacter(codepoint) {
    return codepoint <= 31 || codepoint >= 127 && codepoint <= 159;
  }
  function keysym_from_charcode(codepoint) {
    if (isControlCharacter(codepoint)) return 65280 | codepoint;
    if (codepoint >= 0 && codepoint <= 255)
      return codepoint;
    if (codepoint >= 256 && codepoint <= 1114111)
      return 16777216 | codepoint;
    return null;
  }
  function keysym_from_keycode(keyCode, location) {
    return get_keysym(keycodeKeysyms[keyCode], location);
  }
  var key_identifier_sane = function key_identifier_sane2(keyCode, keyIdentifier) {
    if (!keyIdentifier)
      return false;
    var unicodePrefixLocation = keyIdentifier.indexOf("U+");
    if (unicodePrefixLocation === -1)
      return true;
    var codepoint = parseInt(keyIdentifier.substring(unicodePrefixLocation + 2), 16);
    if (keyCode !== codepoint)
      return true;
    if (keyCode >= 65 && keyCode <= 90 || keyCode >= 48 && keyCode <= 57)
      return true;
    return false;
  };
  this.press = function(keysym) {
    if (keysym === null) return;
    if (!guac_keyboard.pressed[keysym]) {
      guac_keyboard.pressed[keysym] = true;
      if (guac_keyboard.onkeydown) {
        var result = guac_keyboard.onkeydown(keysym);
        last_keydown_result[keysym] = result;
        globalThis.clearTimeout(key_repeat_timeout);
        globalThis.clearInterval(key_repeat_interval);
        if (!no_repeat[keysym])
          key_repeat_timeout = globalThis.setTimeout(function() {
            key_repeat_interval = globalThis.setInterval(function() {
              guac_keyboard.onkeyup(keysym);
              guac_keyboard.onkeydown(keysym);
            }, 50);
          }, 500);
        return result;
      }
    }
    return last_keydown_result[keysym] || false;
  };
  this.release = function(keysym) {
    if (guac_keyboard.pressed[keysym]) {
      delete guac_keyboard.pressed[keysym];
      delete implicitlyPressed[keysym];
      globalThis.clearTimeout(key_repeat_timeout);
      globalThis.clearInterval(key_repeat_interval);
      if (keysym !== null && guac_keyboard.onkeyup)
        guac_keyboard.onkeyup(keysym);
    }
  };
  this.type = function type(str) {
    for (var i = 0; i < str.length; i++) {
      var codepoint = str.codePointAt ? str.codePointAt(i) : str.charCodeAt(i);
      var keysym = keysym_from_charcode(codepoint);
      guac_keyboard.press(keysym);
      guac_keyboard.release(keysym);
    }
  };
  this.reset = function() {
    for (var keysym in guac_keyboard.pressed)
      guac_keyboard.release(parseInt(keysym));
    eventLog = [];
  };
  var updateModifierState = function updateModifierState2(modifier, keysyms, keyEvent) {
    var localState = keyEvent.modifiers[modifier];
    var remoteState = guac_keyboard.modifiers[modifier];
    var i;
    if (keysyms.indexOf(keyEvent.keysym) !== -1)
      return;
    if (remoteState && localState === false) {
      for (i = 0; i < keysyms.length; i++) {
        guac_keyboard.release(keysyms[i]);
      }
    } else if (!remoteState && localState) {
      for (i = 0; i < keysyms.length; i++) {
        if (guac_keyboard.pressed[keysyms[i]])
          return;
      }
      var keysym = keysyms[0];
      if (keyEvent.keysym)
        implicitlyPressed[keysym] = true;
      guac_keyboard.press(keysym);
    }
  };
  var syncModifierStates = function syncModifierStates2(keyEvent) {
    updateModifierState("alt", [
      65513,
      // Left alt
      65514,
      // Right alt
      65027
      // AltGr
    ], keyEvent);
    updateModifierState("shift", [
      65505,
      // Left shift
      65506
      // Right shift
    ], keyEvent);
    updateModifierState("ctrl", [
      65507,
      // Left ctrl
      65508
      // Right ctrl
    ], keyEvent);
    updateModifierState("meta", [
      65511,
      // Left meta
      65512
      // Right meta
    ], keyEvent);
    updateModifierState("hyper", [
      65515,
      // Left super/hyper
      65516
      // Right super/hyper
    ], keyEvent);
    guac_keyboard.modifiers = keyEvent.modifiers;
  };
  var isStateImplicit = function isStateImplicit2() {
    for (var keysym in guac_keyboard.pressed) {
      if (!implicitlyPressed[keysym])
        return false;
    }
    return true;
  };
  function interpret_events() {
    var handled_event = interpret_event();
    if (!handled_event)
      return false;
    var last_event;
    do {
      last_event = handled_event;
      handled_event = interpret_event();
    } while (handled_event !== null);
    if (isStateImplicit())
      guac_keyboard.reset();
    return last_event.defaultPrevented;
  }
  var release_simulated_altgr = function release_simulated_altgr2(keysym) {
    if (!guac_keyboard.modifiers.ctrl || !guac_keyboard.modifiers.alt)
      return;
    if (keysym >= 65 && keysym <= 90)
      return;
    if (keysym >= 97 && keysym <= 122)
      return;
    if (keysym <= 255 || (keysym & 4278190080) === 16777216) {
      guac_keyboard.release(65507);
      guac_keyboard.release(65508);
      guac_keyboard.release(65513);
      guac_keyboard.release(65514);
    }
  };
  var interpret_event = function interpret_event2() {
    var first = eventLog[0];
    if (!first)
      return null;
    if (first instanceof KeydownEvent) {
      var keysym = null;
      var accepted_events = [];
      if (first.keysym === 65511 || first.keysym === 65512) {
        if (eventLog.length === 1)
          return null;
        if (eventLog[1].keysym !== first.keysym) {
          if (!eventLog[1].modifiers.meta)
            return eventLog.shift();
        } else if (eventLog[1] instanceof KeydownEvent)
          return eventLog.shift();
      }
      if (first.reliable) {
        keysym = first.keysym;
        accepted_events = eventLog.splice(0, 1);
      } else if (eventLog[1] instanceof KeypressEvent) {
        keysym = eventLog[1].keysym;
        accepted_events = eventLog.splice(0, 2);
      } else if (eventLog[1]) {
        keysym = first.keysym;
        accepted_events = eventLog.splice(0, 1);
      }
      if (accepted_events.length > 0) {
        syncModifierStates(first);
        if (keysym) {
          release_simulated_altgr(keysym);
          var defaultPrevented = !guac_keyboard.press(keysym);
          recentKeysym[first.keyCode] = keysym;
          if (!first.keyupReliable)
            guac_keyboard.release(keysym);
          for (var i = 0; i < accepted_events.length; i++)
            accepted_events[i].defaultPrevented = defaultPrevented;
        }
        return first;
      }
    } else if (first instanceof KeyupEvent && !quirks.keyupUnreliable) {
      var keysym = first.keysym;
      if (keysym) {
        guac_keyboard.release(keysym);
        delete recentKeysym[first.keyCode];
        first.defaultPrevented = true;
      } else {
        guac_keyboard.reset();
        return first;
      }
      syncModifierStates(first);
      return eventLog.shift();
    } else
      return eventLog.shift();
    return null;
  };
  var getEventLocation = function getEventLocation2(e) {
    if ("location" in e)
      return e.location;
    if ("keyLocation" in e)
      return e.keyLocation;
    return 0;
  };
  var markEvent = function markEvent2(e) {
    if (e[EVENT_MARKER])
      return false;
    e[EVENT_MARKER] = true;
    return true;
  };
  this.listenTo = function listenTo(element2) {
    element2.addEventListener("keydown", function(e) {
      if (!guac_keyboard.onkeydown) return;
      if (!markEvent(e)) return;
      var keydownEvent = new KeydownEvent(e);
      if (keydownEvent.keyCode === 229)
        return;
      eventLog.push(keydownEvent);
      if (interpret_events())
        e.preventDefault();
    }, true);
    element2.addEventListener("keypress", function(e) {
      if (!guac_keyboard.onkeydown && !guac_keyboard.onkeyup) return;
      if (!markEvent(e)) return;
      eventLog.push(new KeypressEvent(e));
      if (interpret_events())
        e.preventDefault();
    }, true);
    element2.addEventListener("keyup", function(e) {
      if (!guac_keyboard.onkeyup) return;
      if (!markEvent(e)) return;
      e.preventDefault();
      eventLog.push(new KeyupEvent(e));
      interpret_events();
    }, true);
    var handleInput = function handleInput2(e) {
      if (!guac_keyboard.onkeydown && !guac_keyboard.onkeyup) return;
      if (!markEvent(e)) return;
      if (e.data && !e.isComposing) {
        element2.removeEventListener("compositionend", handleComposition, false);
        guac_keyboard.type(e.data);
      }
    };
    var handleComposition = function handleComposition2(e) {
      if (!guac_keyboard.onkeydown && !guac_keyboard.onkeyup) return;
      if (!markEvent(e)) return;
      if (e.data) {
        element2.removeEventListener("input", handleInput, false);
        guac_keyboard.type(e.data);
      }
    };
    element2.addEventListener("input", handleInput, false);
    element2.addEventListener("compositionend", handleComposition, false);
  };
  if (element)
    guac_keyboard.listenTo(element);
};
Guacamole.Keyboard._nextID = 0;
Guacamole.Keyboard.ModifierState = function() {
  this.shift = false;
  this.ctrl = false;
  this.alt = false;
  this.meta = false;
  this.hyper = false;
};
Guacamole.Keyboard.ModifierState.fromKeyboardEvent = function(e) {
  var state = new Guacamole.Keyboard.ModifierState();
  state.shift = e.shiftKey;
  state.ctrl = e.ctrlKey;
  state.alt = e.altKey;
  state.meta = e.metaKey;
  if (e.getModifierState) {
    state.hyper = e.getModifierState("OS") || e.getModifierState("Super") || e.getModifierState("Hyper") || e.getModifierState("Win");
  }
  return state;
};
var Guacamole = Guacamole || {};
Guacamole.Layer = function(width, height) {
  var layer = this;
  var CANVAS_SIZE_FACTOR = 64;
  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");
  context.save();
  var empty = true;
  var pathClosed = true;
  var stackSize = 0;
  var compositeOperation = {
    /* 0x0 NOT IMPLEMENTED */
    1: "destination-in",
    2: "destination-out",
    /* 0x3 NOT IMPLEMENTED */
    4: "source-in",
    /* 0x5 NOT IMPLEMENTED */
    6: "source-atop",
    /* 0x7 NOT IMPLEMENTED */
    8: "source-out",
    9: "destination-atop",
    10: "xor",
    11: "destination-over",
    12: "copy",
    /* 0xD NOT IMPLEMENTED */
    14: "source-over",
    15: "lighter"
  };
  var resize = function resize2(newWidth, newHeight) {
    newWidth = newWidth || 0;
    newHeight = newHeight || 0;
    var canvasWidth = Math.ceil(newWidth / CANVAS_SIZE_FACTOR) * CANVAS_SIZE_FACTOR;
    var canvasHeight = Math.ceil(newHeight / CANVAS_SIZE_FACTOR) * CANVAS_SIZE_FACTOR;
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      var oldData = null;
      if (!empty && canvas.width !== 0 && canvas.height !== 0) {
        oldData = document.createElement("canvas");
        oldData.width = Math.min(layer.width, newWidth);
        oldData.height = Math.min(layer.height, newHeight);
        var oldDataContext = oldData.getContext("2d");
        oldDataContext.drawImage(
          canvas,
          0,
          0,
          oldData.width,
          oldData.height,
          0,
          0,
          oldData.width,
          oldData.height
        );
      }
      var oldCompositeOperation = context.globalCompositeOperation;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      if (oldData)
        context.drawImage(
          oldData,
          0,
          0,
          oldData.width,
          oldData.height,
          0,
          0,
          oldData.width,
          oldData.height
        );
      context.globalCompositeOperation = oldCompositeOperation;
      stackSize = 0;
      context.save();
    } else
      layer.reset();
    layer.width = newWidth;
    layer.height = newHeight;
  };
  function fitRect(x, y, w, h) {
    var opBoundX = w + x;
    var opBoundY = h + y;
    var resizeWidth;
    if (opBoundX > layer.width)
      resizeWidth = opBoundX;
    else
      resizeWidth = layer.width;
    var resizeHeight;
    if (opBoundY > layer.height)
      resizeHeight = opBoundY;
    else
      resizeHeight = layer.height;
    layer.resize(resizeWidth, resizeHeight);
  }
  this.autosize = false;
  this.width = width;
  this.height = height;
  this.getCanvas = function getCanvas() {
    return canvas;
  };
  this.toCanvas = function toCanvas() {
    var canvas2 = document.createElement("canvas");
    canvas2.width = layer.width;
    canvas2.height = layer.height;
    var context2 = canvas2.getContext("2d");
    context2.drawImage(layer.getCanvas(), 0, 0);
    return canvas2;
  };
  this.resize = function(newWidth, newHeight) {
    if (newWidth !== layer.width || newHeight !== layer.height)
      resize(newWidth, newHeight);
  };
  this.drawImage = function(x, y, image) {
    if (layer.autosize) fitRect(x, y, image.width, image.height);
    context.drawImage(image, x, y);
    empty = false;
  };
  this.transfer = function(srcLayer, srcx, srcy, srcw, srch, x, y, transferFunction) {
    var srcCanvas = srcLayer.getCanvas();
    if (srcx >= srcCanvas.width || srcy >= srcCanvas.height) return;
    if (srcx + srcw > srcCanvas.width)
      srcw = srcCanvas.width - srcx;
    if (srcy + srch > srcCanvas.height)
      srch = srcCanvas.height - srcy;
    if (srcw === 0 || srch === 0) return;
    if (layer.autosize) fitRect(x, y, srcw, srch);
    var src = srcLayer.getCanvas().getContext("2d").getImageData(srcx, srcy, srcw, srch);
    var dst = context.getImageData(x, y, srcw, srch);
    for (var i = 0; i < srcw * srch * 4; i += 4) {
      var src_pixel = new Guacamole.Layer.Pixel(
        src.data[i],
        src.data[i + 1],
        src.data[i + 2],
        src.data[i + 3]
      );
      var dst_pixel = new Guacamole.Layer.Pixel(
        dst.data[i],
        dst.data[i + 1],
        dst.data[i + 2],
        dst.data[i + 3]
      );
      transferFunction(src_pixel, dst_pixel);
      dst.data[i] = dst_pixel.red;
      dst.data[i + 1] = dst_pixel.green;
      dst.data[i + 2] = dst_pixel.blue;
      dst.data[i + 3] = dst_pixel.alpha;
    }
    context.putImageData(dst, x, y);
    empty = false;
  };
  this.put = function(srcLayer, srcx, srcy, srcw, srch, x, y) {
    var srcCanvas = srcLayer.getCanvas();
    if (srcx >= srcCanvas.width || srcy >= srcCanvas.height) return;
    if (srcx + srcw > srcCanvas.width)
      srcw = srcCanvas.width - srcx;
    if (srcy + srch > srcCanvas.height)
      srch = srcCanvas.height - srcy;
    if (srcw === 0 || srch === 0) return;
    if (layer.autosize) fitRect(x, y, srcw, srch);
    var src = srcLayer.getCanvas().getContext("2d").getImageData(srcx, srcy, srcw, srch);
    context.putImageData(src, x, y);
    empty = false;
  };
  this.copy = function(srcLayer, srcx, srcy, srcw, srch, x, y) {
    var srcCanvas = srcLayer.getCanvas();
    if (srcx >= srcCanvas.width || srcy >= srcCanvas.height) return;
    if (srcx + srcw > srcCanvas.width)
      srcw = srcCanvas.width - srcx;
    if (srcy + srch > srcCanvas.height)
      srch = srcCanvas.height - srcy;
    if (srcw === 0 || srch === 0) return;
    if (layer.autosize) fitRect(x, y, srcw, srch);
    context.drawImage(srcCanvas, srcx, srcy, srcw, srch, x, y, srcw, srch);
    empty = false;
  };
  this.moveTo = function(x, y) {
    if (pathClosed) {
      context.beginPath();
      pathClosed = false;
    }
    if (layer.autosize) fitRect(x, y, 0, 0);
    context.moveTo(x, y);
  };
  this.lineTo = function(x, y) {
    if (pathClosed) {
      context.beginPath();
      pathClosed = false;
    }
    if (layer.autosize) fitRect(x, y, 0, 0);
    context.lineTo(x, y);
  };
  this.arc = function(x, y, radius, startAngle, endAngle, negative) {
    if (pathClosed) {
      context.beginPath();
      pathClosed = false;
    }
    if (layer.autosize) fitRect(x, y, 0, 0);
    context.arc(x, y, radius, startAngle, endAngle, negative);
  };
  this.curveTo = function(cp1x, cp1y, cp2x, cp2y, x, y) {
    if (pathClosed) {
      context.beginPath();
      pathClosed = false;
    }
    if (layer.autosize) fitRect(x, y, 0, 0);
    context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
  };
  this.close = function() {
    context.closePath();
    pathClosed = true;
  };
  this.rect = function(x, y, w, h) {
    if (pathClosed) {
      context.beginPath();
      pathClosed = false;
    }
    if (layer.autosize) fitRect(x, y, w, h);
    context.rect(x, y, w, h);
  };
  this.clip = function() {
    context.clip();
    pathClosed = true;
  };
  this.strokeColor = function(cap, join, thickness, r, g, b, a) {
    context.lineCap = cap;
    context.lineJoin = join;
    context.lineWidth = thickness;
    context.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + a / 255 + ")";
    context.stroke();
    empty = false;
    pathClosed = true;
  };
  this.fillColor = function(r, g, b, a) {
    context.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a / 255 + ")";
    context.fill();
    empty = false;
    pathClosed = true;
  };
  this.strokeLayer = function(cap, join, thickness, srcLayer) {
    context.lineCap = cap;
    context.lineJoin = join;
    context.lineWidth = thickness;
    context.strokeStyle = context.createPattern(
      srcLayer.getCanvas(),
      "repeat"
    );
    context.stroke();
    empty = false;
    pathClosed = true;
  };
  this.fillLayer = function(srcLayer) {
    context.fillStyle = context.createPattern(
      srcLayer.getCanvas(),
      "repeat"
    );
    context.fill();
    empty = false;
    pathClosed = true;
  };
  this.push = function() {
    context.save();
    stackSize++;
  };
  this.pop = function() {
    if (stackSize > 0) {
      context.restore();
      stackSize--;
    }
  };
  this.reset = function() {
    while (stackSize > 0) {
      context.restore();
      stackSize--;
    }
    context.restore();
    context.save();
    context.beginPath();
    pathClosed = false;
  };
  this.setTransform = function(a, b, c, d, e, f) {
    context.setTransform(
      a,
      b,
      c,
      d,
      e,
      f
      /*0, 0, 1*/
    );
  };
  this.transform = function(a, b, c, d, e, f) {
    context.transform(
      a,
      b,
      c,
      d,
      e,
      f
      /*0, 0, 1*/
    );
  };
  this.setChannelMask = function(mask) {
    context.globalCompositeOperation = compositeOperation[mask];
  };
  this.setMiterLimit = function(limit) {
    context.miterLimit = limit;
  };
  resize(width, height);
  canvas.style.zIndex = -1;
};
Guacamole.Layer.ROUT = 2;
Guacamole.Layer.ATOP = 6;
Guacamole.Layer.XOR = 10;
Guacamole.Layer.ROVER = 11;
Guacamole.Layer.OVER = 14;
Guacamole.Layer.PLUS = 15;
Guacamole.Layer.RIN = 1;
Guacamole.Layer.IN = 4;
Guacamole.Layer.OUT = 8;
Guacamole.Layer.RATOP = 9;
Guacamole.Layer.SRC = 12;
Guacamole.Layer.Pixel = function(r, g, b, a) {
  this.red = r;
  this.green = g;
  this.blue = b;
  this.alpha = a;
};
var Guacamole = Guacamole || {};
Guacamole.Mouse = function Mouse(element) {
  Guacamole.Mouse.Event.Target.call(this);
  var guac_mouse = this;
  this.touchMouseThreshold = 3;
  this.scrollThreshold = 53;
  this.PIXELS_PER_LINE = 18;
  this.PIXELS_PER_PAGE = this.PIXELS_PER_LINE * 16;
  var MOUSE_BUTTONS = [
    Guacamole.Mouse.State.Buttons.LEFT,
    Guacamole.Mouse.State.Buttons.MIDDLE,
    Guacamole.Mouse.State.Buttons.RIGHT
  ];
  var ignore_mouse = 0;
  var scroll_delta = 0;
  element.addEventListener("contextmenu", function(e) {
    Guacamole.Event.DOMEvent.cancelEvent(e);
  }, false);
  element.addEventListener("mousemove", function(e) {
    if (ignore_mouse) {
      Guacamole.Event.DOMEvent.cancelEvent(e);
      ignore_mouse--;
      return;
    }
    guac_mouse.move(Guacamole.Position.fromClientPosition(element, e.clientX, e.clientY), e);
  }, false);
  element.addEventListener("mousedown", function(e) {
    if (ignore_mouse) {
      Guacamole.Event.DOMEvent.cancelEvent(e);
      return;
    }
    var button = MOUSE_BUTTONS[e.button];
    if (button)
      guac_mouse.press(button, e);
  }, false);
  element.addEventListener("mouseup", function(e) {
    if (ignore_mouse) {
      Guacamole.Event.DOMEvent.cancelEvent(e);
      return;
    }
    var button = MOUSE_BUTTONS[e.button];
    if (button)
      guac_mouse.release(button, e);
  }, false);
  element.addEventListener("mouseout", function(e) {
    if (!e) e = globalThis.event;
    var target = e.relatedTarget || e.toElement;
    while (target) {
      if (target === element)
        return;
      target = target.parentNode;
    }
    guac_mouse.reset(e);
    guac_mouse.out(e);
  }, false);
  element.addEventListener("selectstart", function(e) {
    Guacamole.Event.DOMEvent.cancelEvent(e);
  }, false);
  function ignorePendingMouseEvents() {
    ignore_mouse = guac_mouse.touchMouseThreshold;
  }
  element.addEventListener("touchmove", ignorePendingMouseEvents, false);
  element.addEventListener("touchstart", ignorePendingMouseEvents, false);
  element.addEventListener("touchend", ignorePendingMouseEvents, false);
  function mousewheel_handler(e) {
    var delta = e.deltaY || -e.wheelDeltaY || -e.wheelDelta;
    if (delta) {
      if (e.deltaMode === 1)
        delta = e.deltaY * guac_mouse.PIXELS_PER_LINE;
      else if (e.deltaMode === 2)
        delta = e.deltaY * guac_mouse.PIXELS_PER_PAGE;
    } else
      delta = e.detail * guac_mouse.PIXELS_PER_LINE;
    scroll_delta += delta;
    if (scroll_delta <= -guac_mouse.scrollThreshold) {
      do {
        guac_mouse.click(Guacamole.Mouse.State.Buttons.UP);
        scroll_delta += guac_mouse.scrollThreshold;
      } while (scroll_delta <= -guac_mouse.scrollThreshold);
      scroll_delta = 0;
    }
    if (scroll_delta >= guac_mouse.scrollThreshold) {
      do {
        guac_mouse.click(Guacamole.Mouse.State.Buttons.DOWN);
        scroll_delta -= guac_mouse.scrollThreshold;
      } while (scroll_delta >= guac_mouse.scrollThreshold);
      scroll_delta = 0;
    }
    Guacamole.Event.DOMEvent.cancelEvent(e);
  }
  element.addEventListener("DOMMouseScroll", mousewheel_handler, false);
  element.addEventListener("mousewheel", mousewheel_handler, false);
  element.addEventListener("wheel", mousewheel_handler, false);
  var CSS3_CURSOR_SUPPORTED = function() {
    var div = document.createElement("div");
    if (!("cursor" in div.style))
      return false;
    try {
      div.style.cursor = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==) 0 0, auto";
    } catch (e) {
      return false;
    }
    return /\burl\([^()]*\)\s+0\s+0\b/.test(div.style.cursor || "");
  }();
  this.setCursor = function(canvas, x, y) {
    if (CSS3_CURSOR_SUPPORTED) {
      var dataURL = canvas.toDataURL("image/png");
      element.style.cursor = "url(" + dataURL + ") " + x + " " + y + ", auto";
      return true;
    }
    return false;
  };
};
Guacamole.Mouse.State = function State(template) {
  var legacyConstructor = function legacyConstructor2(x, y, left, middle, right, up, down) {
    return {
      x,
      y,
      left,
      middle,
      right,
      up,
      down
    };
  };
  if (arguments.length > 1)
    template = legacyConstructor.apply(this, arguments);
  else
    template = template || {};
  Guacamole.Position.call(this, template);
  this.left = template.left || false;
  this.middle = template.middle || false;
  this.right = template.right || false;
  this.up = template.up || false;
  this.down = template.down || false;
};
Guacamole.Mouse.State.Buttons = {
  /**
   * The name of the {@link Guacamole.Mouse.State} property representing the
   * left mouse button.
   *
   * @constant
   * @type {!string}
   */
  LEFT: "left",
  /**
   * The name of the {@link Guacamole.Mouse.State} property representing the
   * middle mouse button.
   *
   * @constant
   * @type {!string}
   */
  MIDDLE: "middle",
  /**
   * The name of the {@link Guacamole.Mouse.State} property representing the
   * right mouse button.
   *
   * @constant
   * @type {!string}
   */
  RIGHT: "right",
  /**
   * The name of the {@link Guacamole.Mouse.State} property representing the
   * up mouse button (the fourth mouse button, clicked when the mouse scroll
   * wheel is scrolled up).
   *
   * @constant
   * @type {!string}
   */
  UP: "up",
  /**
   * The name of the {@link Guacamole.Mouse.State} property representing the
   * down mouse button (the fifth mouse button, clicked when the mouse scroll
   * wheel is scrolled up).
   *
   * @constant
   * @type {!string}
   */
  DOWN: "down"
};
Guacamole.Mouse.Event = function MouseEvent(type, state, events) {
  Guacamole.Event.DOMEvent.call(this, type, events);
  var legacyHandlerName = "on" + this.type;
  this.state = state;
  this.invokeLegacyHandler = function invokeLegacyHandler(target) {
    if (target[legacyHandlerName]) {
      this.preventDefault();
      this.stopPropagation();
      target[legacyHandlerName](this.state);
    }
  };
};
Guacamole.Mouse.Event.Target = function MouseEventTarget() {
  Guacamole.Event.Target.call(this);
  this.currentState = new Guacamole.Mouse.State();
  this.press = function press(button, events) {
    if (!this.currentState[button]) {
      this.currentState[button] = true;
      this.dispatch(new Guacamole.Mouse.Event("mousedown", this.currentState, events));
    }
  };
  this.release = function release(button, events) {
    if (this.currentState[button]) {
      this.currentState[button] = false;
      this.dispatch(new Guacamole.Mouse.Event("mouseup", this.currentState, events));
    }
  };
  this.click = function click(button, events) {
    this.press(button, events);
    this.release(button, events);
  };
  this.move = function move(position, events) {
    if (this.currentState.x !== position.x || this.currentState.y !== position.y) {
      this.currentState.x = position.x;
      this.currentState.y = position.y;
      this.dispatch(new Guacamole.Mouse.Event("mousemove", this.currentState, events));
    }
  };
  this.out = function out(events) {
    this.dispatch(new Guacamole.Mouse.Event("mouseout", this.currentState, events));
  };
  this.reset = function reset(events) {
    for (var button in Guacamole.Mouse.State.Buttons) {
      this.release(Guacamole.Mouse.State.Buttons[button], events);
    }
  };
};
Guacamole.Mouse.Touchpad = function Touchpad(element) {
  Guacamole.Mouse.Event.Target.call(this);
  var guac_touchpad = this;
  this.scrollThreshold = 20 * (globalThis.devicePixelRatio || 1);
  this.clickTimingThreshold = 250;
  this.clickMoveThreshold = 10 * (globalThis.devicePixelRatio || 1);
  this.currentState = new Guacamole.Mouse.State();
  var touch_count = 0;
  var last_touch_x = 0;
  var last_touch_y = 0;
  var last_touch_time = 0;
  var pixels_moved = 0;
  var touch_buttons = {
    1: "left",
    2: "right",
    3: "middle"
  };
  var gesture_in_progress = false;
  var click_release_timeout = null;
  element.addEventListener("touchend", function(e) {
    e.preventDefault();
    if (gesture_in_progress && e.touches.length === 0) {
      var time = (/* @__PURE__ */ new Date()).getTime();
      var button = touch_buttons[touch_count];
      if (guac_touchpad.currentState[button]) {
        guac_touchpad.release(button, e);
        if (click_release_timeout) {
          globalThis.clearTimeout(click_release_timeout);
          click_release_timeout = null;
        }
      }
      if (time - last_touch_time <= guac_touchpad.clickTimingThreshold && pixels_moved < guac_touchpad.clickMoveThreshold) {
        guac_touchpad.press(button, e);
        click_release_timeout = globalThis.setTimeout(function() {
          guac_touchpad.release(button, e);
          gesture_in_progress = false;
        }, guac_touchpad.clickTimingThreshold);
      }
      if (!click_release_timeout)
        gesture_in_progress = false;
    }
  }, false);
  element.addEventListener("touchstart", function(e) {
    e.preventDefault();
    touch_count = Math.min(e.touches.length, 3);
    if (click_release_timeout) {
      globalThis.clearTimeout(click_release_timeout);
      click_release_timeout = null;
    }
    if (!gesture_in_progress) {
      gesture_in_progress = true;
      var starting_touch = e.touches[0];
      last_touch_x = starting_touch.clientX;
      last_touch_y = starting_touch.clientY;
      last_touch_time = (/* @__PURE__ */ new Date()).getTime();
      pixels_moved = 0;
    }
  }, false);
  element.addEventListener("touchmove", function(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var delta_x = touch.clientX - last_touch_x;
    var delta_y = touch.clientY - last_touch_y;
    pixels_moved += Math.abs(delta_x) + Math.abs(delta_y);
    if (touch_count === 1) {
      var velocity = pixels_moved / ((/* @__PURE__ */ new Date()).getTime() - last_touch_time);
      var scale = 1 + velocity;
      var position = new Guacamole.Position(guac_touchpad.currentState);
      position.x += delta_x * scale;
      position.y += delta_y * scale;
      position.x = Math.min(Math.max(0, position.x), element.offsetWidth - 1);
      position.y = Math.min(Math.max(0, position.y), element.offsetHeight - 1);
      guac_touchpad.move(position, e);
      last_touch_x = touch.clientX;
      last_touch_y = touch.clientY;
    } else if (touch_count === 2) {
      if (Math.abs(delta_y) >= guac_touchpad.scrollThreshold) {
        var button;
        if (delta_y > 0) button = "down";
        else button = "up";
        guac_touchpad.click(button, e);
        last_touch_x = touch.clientX;
        last_touch_y = touch.clientY;
      }
    }
  }, false);
};
Guacamole.Mouse.Touchscreen = function Touchscreen(element) {
  Guacamole.Mouse.Event.Target.call(this);
  var guac_touchscreen = this;
  var gesture_in_progress = false;
  var gesture_start_x = null;
  var gesture_start_y = null;
  var click_release_timeout = null;
  var long_press_timeout = null;
  this.scrollThreshold = 20 * (globalThis.devicePixelRatio || 1);
  this.clickTimingThreshold = 250;
  this.clickMoveThreshold = 16 * (globalThis.devicePixelRatio || 1);
  this.longPressThreshold = 500;
  function finger_moved(e) {
    var touch = e.touches[0] || e.changedTouches[0];
    var delta_x = touch.clientX - gesture_start_x;
    var delta_y = touch.clientY - gesture_start_y;
    return Math.sqrt(delta_x * delta_x + delta_y * delta_y) >= guac_touchscreen.clickMoveThreshold;
  }
  function begin_gesture(e) {
    var touch = e.touches[0];
    gesture_in_progress = true;
    gesture_start_x = touch.clientX;
    gesture_start_y = touch.clientY;
  }
  function end_gesture() {
    globalThis.clearTimeout(click_release_timeout);
    globalThis.clearTimeout(long_press_timeout);
    gesture_in_progress = false;
  }
  element.addEventListener("touchend", function(e) {
    if (!gesture_in_progress)
      return;
    if (e.touches.length !== 0 || e.changedTouches.length !== 1) {
      end_gesture();
      return;
    }
    globalThis.clearTimeout(long_press_timeout);
    guac_touchscreen.release(Guacamole.Mouse.State.Buttons.LEFT, e);
    if (!finger_moved(e)) {
      e.preventDefault();
      if (!guac_touchscreen.currentState.left) {
        var touch = e.changedTouches[0];
        guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY));
        guac_touchscreen.press(Guacamole.Mouse.State.Buttons.LEFT, e);
        click_release_timeout = globalThis.setTimeout(function() {
          guac_touchscreen.release(Guacamole.Mouse.State.Buttons.LEFT, e);
          end_gesture();
        }, guac_touchscreen.clickTimingThreshold);
      }
    }
  }, false);
  element.addEventListener("touchstart", function(e) {
    if (e.touches.length !== 1) {
      end_gesture();
      return;
    }
    e.preventDefault();
    begin_gesture(e);
    globalThis.clearTimeout(click_release_timeout);
    long_press_timeout = globalThis.setTimeout(function() {
      var touch = e.touches[0];
      guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY));
      guac_touchscreen.click(Guacamole.Mouse.State.Buttons.RIGHT, e);
      end_gesture();
    }, guac_touchscreen.longPressThreshold);
  }, false);
  element.addEventListener("touchmove", function(e) {
    if (!gesture_in_progress)
      return;
    if (finger_moved(e))
      globalThis.clearTimeout(long_press_timeout);
    if (e.touches.length !== 1) {
      end_gesture();
      return;
    }
    if (guac_touchscreen.currentState.left) {
      e.preventDefault();
      var touch = e.touches[0];
      guac_touchscreen.move(Guacamole.Position.fromClientPosition(element, touch.clientX, touch.clientY), e);
    }
  }, false);
};
var Guacamole = Guacamole || {};
var Guacamole = Guacamole || {};
Guacamole.Object = function guacamoleObject(client, index) {
  var guacObject = this;
  var bodyCallbacks = {};
  var dequeueBodyCallback = function dequeueBodyCallback2(name) {
    var callbacks = bodyCallbacks[name];
    if (!callbacks)
      return null;
    var callback = callbacks.shift();
    if (callbacks.length === 0)
      delete bodyCallbacks[name];
    return callback;
  };
  var enqueueBodyCallback = function enqueueBodyCallback2(name, callback) {
    var callbacks = bodyCallbacks[name];
    if (!callbacks) {
      callbacks = [];
      bodyCallbacks[name] = callbacks;
    }
    callbacks.push(callback);
  };
  this.index = index;
  this.onbody = function defaultBodyHandler(inputStream, mimetype, name) {
    var callback = dequeueBodyCallback(name);
    if (callback)
      callback(inputStream, mimetype);
  };
  this.onundefine = null;
  this.requestInputStream = function requestInputStream(name, bodyCallback) {
    if (bodyCallback)
      enqueueBodyCallback(name, bodyCallback);
    client.requestObjectInputStream(guacObject.index, name);
  };
  this.createOutputStream = function createOutputStream(mimetype, name) {
    return client.createObjectOutputStream(guacObject.index, mimetype, name);
  };
};
Guacamole.Object.ROOT_STREAM = "/";
Guacamole.Object.STREAM_INDEX_MIMETYPE = "application/vnd.glyptodon.guacamole.stream-index+json";
var Guacamole = Guacamole || {};
Guacamole.OnScreenKeyboard = function(layout) {
  var osk = this;
  var modifierKeysyms = {};
  var pressed = {};
  var scaledElements = [];
  var addClass = function addClass2(element, classname) {
    if (element.classList)
      element.classList.add(classname);
    else
      element.className += " " + classname;
  };
  var removeClass = function removeClass2(element, classname) {
    if (element.classList)
      element.classList.remove(classname);
    else {
      element.className = element.className.replace(
        /([^ ]+)[ ]*/g,
        function removeMatchingClasses(match, testClassname) {
          if (testClassname === classname)
            return "";
          return match;
        }
      );
    }
  };
  var ignoreMouse = 0;
  var ignorePendingMouseEvents = function ignorePendingMouseEvents2() {
    ignoreMouse = osk.touchMouseThreshold;
  };
  var ScaledElement = function ScaledElement2(element, width, height, scaleFont) {
    this.width = width;
    this.height = height;
    this.scale = function(pixels) {
      element.style.width = width * pixels + "px";
      element.style.height = height * pixels + "px";
      if (scaleFont) {
        element.style.lineHeight = height * pixels + "px";
        element.style.fontSize = pixels + "px";
      }
    };
  };
  var modifiersPressed = function modifiersPressed2(names) {
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!(name in modifierKeysyms))
        return false;
    }
    return true;
  };
  var getActiveKey = function getActiveKey2(keyName) {
    var keys = osk.keys[keyName];
    if (!keys)
      return null;
    for (var i = keys.length - 1; i >= 0; i--) {
      var candidate = keys[i];
      if (modifiersPressed(candidate.requires))
        return candidate;
    }
    return null;
  };
  var press = function press2(keyName, keyElement) {
    if (!pressed[keyName]) {
      addClass(keyElement, "guac-keyboard-pressed");
      var key = getActiveKey(keyName);
      if (key.modifier) {
        var modifierClass = "guac-keyboard-modifier-" + getCSSName(key.modifier);
        var originalKeysym = modifierKeysyms[key.modifier];
        if (originalKeysym === void 0) {
          addClass(keyboard, modifierClass);
          modifierKeysyms[key.modifier] = key.keysym;
          if (key.keysym && osk.onkeydown)
            osk.onkeydown(key.keysym);
        } else {
          removeClass(keyboard, modifierClass);
          delete modifierKeysyms[key.modifier];
          if (originalKeysym && osk.onkeyup)
            osk.onkeyup(originalKeysym);
        }
      } else if (osk.onkeydown)
        osk.onkeydown(key.keysym);
      pressed[keyName] = true;
    }
  };
  var release = function release2(keyName, keyElement) {
    if (pressed[keyName]) {
      removeClass(keyElement, "guac-keyboard-pressed");
      var key = getActiveKey(keyName);
      if (!key.modifier && osk.onkeyup)
        osk.onkeyup(key.keysym);
      pressed[keyName] = false;
    }
  };
  var keyboard = document.createElement("div");
  keyboard.className = "guac-keyboard";
  keyboard.onselectstart = keyboard.onmousemove = keyboard.onmouseup = keyboard.onmousedown = function handleMouseEvents(e) {
    if (ignoreMouse)
      ignoreMouse--;
    e.stopPropagation();
    return false;
  };
  this.touchMouseThreshold = 3;
  this.onkeydown = null;
  this.onkeyup = null;
  this.layout = new Guacamole.OnScreenKeyboard.Layout(layout);
  this.getElement = function() {
    return keyboard;
  };
  this.resize = function(width) {
    var unit = Math.floor(width * 10 / osk.layout.width) / 10;
    for (var i = 0; i < scaledElements.length; i++) {
      var scaledElement = scaledElements[i];
      scaledElement.scale(unit);
    }
  };
  var asKeyArray = function asKeyArray2(name, object) {
    if (object instanceof Array) {
      var keys = [];
      for (var i = 0; i < object.length; i++) {
        keys.push(new Guacamole.OnScreenKeyboard.Key(object[i], name));
      }
      return keys;
    }
    if (typeof object === "number") {
      return [new Guacamole.OnScreenKeyboard.Key({
        name,
        keysym: object
      })];
    }
    if (typeof object === "string") {
      return [new Guacamole.OnScreenKeyboard.Key({
        name,
        title: object
      })];
    }
    return [new Guacamole.OnScreenKeyboard.Key(object, name)];
  };
  var getKeys = function getKeys2(keys) {
    var keyArrays = {};
    for (var name in layout.keys) {
      keyArrays[name] = asKeyArray(name, keys[name]);
    }
    return keyArrays;
  };
  this.keys = getKeys(layout.keys);
  var getCSSName = function getCSSName2(name) {
    var cssName = name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
    return cssName;
  };
  var appendElements = function appendElements2(element, object, name) {
    var i;
    var div = document.createElement("div");
    if (name)
      addClass(div, "guac-keyboard-" + getCSSName(name));
    if (object instanceof Array) {
      addClass(div, "guac-keyboard-group");
      for (i = 0; i < object.length; i++)
        appendElements2(div, object[i]);
    } else if (object instanceof Object) {
      addClass(div, "guac-keyboard-group");
      var names = Object.keys(object).sort();
      for (i = 0; i < names.length; i++) {
        var name = names[i];
        appendElements2(div, object[name], name);
      }
    } else if (typeof object === "number") {
      addClass(div, "guac-keyboard-gap");
      scaledElements.push(new ScaledElement(div, object, object));
    } else if (typeof object === "string") {
      var keyName = object;
      if (keyName.length === 1)
        keyName = "0x" + keyName.charCodeAt(0).toString(16);
      addClass(div, "guac-keyboard-key-container");
      var keyElement = document.createElement("div");
      keyElement.className = "guac-keyboard-key guac-keyboard-key-" + getCSSName(keyName);
      var keys = osk.keys[object];
      if (keys) {
        for (i = 0; i < keys.length; i++) {
          var key = keys[i];
          var capElement = document.createElement("div");
          capElement.className = "guac-keyboard-cap";
          capElement.textContent = key.title;
          for (var j = 0; j < key.requires.length; j++) {
            var requirement = key.requires[j];
            addClass(capElement, "guac-keyboard-requires-" + getCSSName(requirement));
            addClass(keyElement, "guac-keyboard-uses-" + getCSSName(requirement));
          }
          keyElement.appendChild(capElement);
        }
      }
      div.appendChild(keyElement);
      scaledElements.push(new ScaledElement(div, osk.layout.keyWidths[object] || 1, 1, true));
      var touchPress = function touchPress2(e) {
        e.preventDefault();
        ignoreMouse = osk.touchMouseThreshold;
        press(object, keyElement);
      };
      var touchRelease = function touchRelease2(e) {
        e.preventDefault();
        ignoreMouse = osk.touchMouseThreshold;
        release(object, keyElement);
      };
      var mousePress = function mousePress2(e) {
        e.preventDefault();
        if (ignoreMouse === 0)
          press(object, keyElement);
      };
      var mouseRelease = function mouseRelease2(e) {
        e.preventDefault();
        if (ignoreMouse === 0)
          release(object, keyElement);
      };
      keyElement.addEventListener("touchstart", touchPress, true);
      keyElement.addEventListener("touchend", touchRelease, true);
      keyElement.addEventListener("mousedown", mousePress, true);
      keyElement.addEventListener("mouseup", mouseRelease, true);
      keyElement.addEventListener("mouseout", mouseRelease, true);
    }
    element.appendChild(div);
  };
  appendElements(keyboard, layout.layout);
};
Guacamole.OnScreenKeyboard.Layout = function(template) {
  this.language = template.language;
  this.type = template.type;
  this.keys = template.keys;
  this.layout = template.layout;
  this.width = template.width;
  this.keyWidths = template.keyWidths || {};
};
Guacamole.OnScreenKeyboard.Key = function(template, name) {
  this.name = name || template.name;
  this.title = template.title || this.name;
  this.keysym = template.keysym || function deriveKeysym(title) {
    if (!title || title.length !== 1)
      return null;
    var charCode = title.charCodeAt(0);
    if (charCode >= 0 && charCode <= 255)
      return charCode;
    if (charCode >= 256 && charCode <= 1114111)
      return 16777216 | charCode;
    return null;
  }(this.title);
  this.modifier = template.modifier;
  this.requires = template.requires || [];
};
var Guacamole = Guacamole || {};
Guacamole.OutputStream = function(client, index) {
  var guac_stream = this;
  this.index = index;
  this.onack = null;
  this.sendBlob = function(data) {
    client.sendBlob(guac_stream.index, data);
  };
  this.sendEnd = function() {
    client.endStream(guac_stream.index);
  };
};
var Guacamole = Guacamole || {};
Guacamole.Parser = function Parser() {
  var parser = this;
  var buffer = "";
  var elementBuffer = [];
  var elementEnd = -1;
  var startIndex = 0;
  var elementCodepoints = 0;
  var BUFFER_TRUNCATION_THRESHOLD = 4096;
  var MIN_CODEPOINT_REQUIRES_SURROGATE = 65536;
  this.receive = function receive(packet, isBuffer) {
    if (isBuffer)
      buffer = packet;
    else {
      if (startIndex > BUFFER_TRUNCATION_THRESHOLD && elementEnd >= startIndex) {
        buffer = buffer.substring(startIndex);
        elementEnd -= startIndex;
        startIndex = 0;
      }
      if (buffer.length)
        buffer += packet;
      else
        buffer = packet;
    }
    while (elementEnd < buffer.length) {
      if (elementEnd >= startIndex) {
        var codepoints = Guacamole.Parser.codePointCount(buffer, startIndex, elementEnd);
        if (codepoints < elementCodepoints) {
          elementEnd += elementCodepoints - codepoints;
          continue;
        } else if (elementCodepoints && buffer.codePointAt(elementEnd - 1) >= MIN_CODEPOINT_REQUIRES_SURROGATE) {
          elementEnd++;
          continue;
        }
        var element = buffer.substring(startIndex, elementEnd);
        var terminator = buffer.substring(elementEnd, elementEnd + 1);
        elementBuffer.push(element);
        if (terminator === ";") {
          var opcode = elementBuffer.shift();
          if (parser.oninstruction !== null)
            parser.oninstruction(opcode, elementBuffer);
          elementBuffer = [];
          if (!isBuffer && elementEnd + 1 === buffer.length) {
            elementEnd = -1;
            buffer = "";
          }
        } else if (terminator !== ",")
          throw new Error('Element terminator of instruction was not ";" nor ",".');
        startIndex = elementEnd + 1;
      }
      var lengthEnd = buffer.indexOf(".", startIndex);
      if (lengthEnd !== -1) {
        elementCodepoints = parseInt(buffer.substring(elementEnd + 1, lengthEnd));
        if (isNaN(elementCodepoints))
          throw new Error("Non-numeric character in element length.");
        startIndex = lengthEnd + 1;
        elementEnd = startIndex + elementCodepoints;
      } else {
        startIndex = buffer.length;
        break;
      }
    }
  };
  this.oninstruction = null;
};
Guacamole.Parser.codePointCount = function codePointCount(str, start, end) {
  str = str.substring(start || 0, end);
  var surrogatePairs = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
  return str.length - (surrogatePairs ? surrogatePairs.length : 0);
};
Guacamole.Parser.toInstruction = function toInstruction(elements) {
  var toElement = function toElement2(value) {
    var str = "" + value;
    return Guacamole.Parser.codePointCount(str) + "." + str;
  };
  var instr = toElement(elements[0]);
  for (var i = 1; i < elements.length; i++)
    instr += "," + toElement(elements[i]);
  return instr + ";";
};
var Guacamole = Guacamole || {};
Guacamole.Position = function Position(template) {
  template = template || {};
  this.x = template.x || 0;
  this.y = template.y || 0;
  this.fromClientPosition = function fromClientPosition2(element, clientX, clientY) {
    this.x = clientX - element.offsetLeft;
    this.y = clientY - element.offsetTop;
    var parent = element.offsetParent;
    while (parent && !(parent === document.body)) {
      this.x -= parent.offsetLeft - parent.scrollLeft;
      this.y -= parent.offsetTop - parent.scrollTop;
      parent = parent.offsetParent;
    }
    if (parent) {
      var documentScrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
      var documentScrollTop = document.body.scrollTop || document.documentElement.scrollTop;
      this.x -= parent.offsetLeft - documentScrollLeft;
      this.y -= parent.offsetTop - documentScrollTop;
    }
  };
};
Guacamole.Position.fromClientPosition = function fromClientPosition(element, clientX, clientY) {
  var position = new Guacamole.Position();
  position.fromClientPosition(element, clientX, clientY);
  return position;
};
var Guacamole = Guacamole || {};
Guacamole.RawAudioFormat = function RawAudioFormat(template) {
  this.bytesPerSample = template.bytesPerSample;
  this.channels = template.channels;
  this.rate = template.rate;
};
Guacamole.RawAudioFormat.parse = function parseFormat(mimetype) {
  var bytesPerSample;
  var rate = null;
  var channels = 1;
  if (mimetype.substring(0, 9) === "audio/L8;") {
    mimetype = mimetype.substring(9);
    bytesPerSample = 1;
  } else if (mimetype.substring(0, 10) === "audio/L16;") {
    mimetype = mimetype.substring(10);
    bytesPerSample = 2;
  } else
    return null;
  var parameters = mimetype.split(",");
  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];
    var equals = parameter.indexOf("=");
    if (equals === -1)
      return null;
    var name = parameter.substring(0, equals);
    var value = parameter.substring(equals + 1);
    switch (name) {
      // Number of audio channels
      case "channels":
        channels = parseInt(value);
        break;
      // Sample rate
      case "rate":
        rate = parseInt(value);
        break;
      // All other parameters are unsupported
      default:
        return null;
    }
  }
  ;
  if (rate === null)
    return null;
  return new Guacamole.RawAudioFormat({
    bytesPerSample,
    channels,
    rate
  });
};
var Guacamole = Guacamole || {};
Guacamole.SessionRecording = function SessionRecording(source) {
  var recording = this;
  var recordingBlob;
  var tunnel = null;
  var BLOCK_SIZE = 262144;
  var KEYFRAME_CHAR_INTERVAL = 16384;
  var KEYFRAME_TIME_INTERVAL = 5e3;
  var frames = [];
  var lastKeyframe = 0;
  var playbackTunnel = new Guacamole.SessionRecording._PlaybackTunnel();
  var playbackClient = new Guacamole.Client(playbackTunnel);
  var currentFrame = -1;
  var startVideoTimestamp = null;
  var startRealTimestamp = null;
  var activeSeek = null;
  var frameStart = 0;
  var frameEnd = 0;
  var aborted = false;
  var seekCallback = null;
  var parseBlob = function parseBlob2(blob, instructionCallback, completionCallback) {
    if (aborted && blob === recordingBlob)
      return;
    var parser = new Guacamole.Parser();
    parser.oninstruction = instructionCallback;
    var offset = 0;
    var reader = new FileReader();
    var readNextBlock = function readNextBlock2() {
      if (aborted && blob === recordingBlob)
        return;
      if (reader.readyState === 2) {
        try {
          parser.receive(reader.result);
        } catch (parseError) {
          if (recording.onerror) {
            recording.onerror(parseError.message);
          }
          return;
        }
      }
      if (offset >= blob.size) {
        if (completionCallback)
          completionCallback();
      } else {
        var block = blob.slice(offset, offset + BLOCK_SIZE);
        offset += block.size;
        reader.readAsText(block);
      }
    };
    reader.onload = readNextBlock;
    readNextBlock();
  };
  var getElementSize = function getElementSize2(value) {
    var valueLength = value.length;
    var protocolSize = valueLength + 3;
    while (valueLength >= 10) {
      protocolSize++;
      valueLength = Math.floor(valueLength / 10);
    }
    return protocolSize;
  };
  playbackClient.connect();
  playbackClient.getDisplay().showCursor(false);
  var loadInstruction = function loadInstruction2(opcode, args) {
    frameEnd += getElementSize(opcode);
    for (var i = 0; i < args.length; i++)
      frameEnd += getElementSize(args[i]);
    if (opcode === "sync") {
      var timestamp = parseInt(args[0]);
      var frame = new Guacamole.SessionRecording._Frame(timestamp, frameStart, frameEnd);
      frames.push(frame);
      frameStart = frameEnd;
      if (frames.length === 1 || frameEnd - frames[lastKeyframe].start >= KEYFRAME_CHAR_INTERVAL && timestamp - frames[lastKeyframe].timestamp >= KEYFRAME_TIME_INTERVAL) {
        frame.keyframe = true;
        lastKeyframe = frames.length - 1;
      }
      if (recording.onprogress)
        recording.onprogress(recording.getDuration(), frameEnd);
    }
  };
  var notifyLoaded = function notifyLoaded2() {
    if (recording.onload)
      recording.onload();
  };
  if (source instanceof Blob) {
    recordingBlob = source;
    parseBlob(recordingBlob, loadInstruction, notifyLoaded);
  } else {
    tunnel = source;
    recordingBlob = new Blob();
    var errorEncountered = false;
    var instructionBuffer = "";
    tunnel.oninstruction = function handleInstruction(opcode, args) {
      instructionBuffer += opcode.length + "." + opcode;
      args.forEach(function appendArg(arg) {
        instructionBuffer += "," + arg.length + "." + arg;
      });
      instructionBuffer += ";";
      if (instructionBuffer.length >= BLOCK_SIZE) {
        recordingBlob = new Blob([recordingBlob, instructionBuffer]);
        instructionBuffer = "";
      }
      loadInstruction(opcode, args);
    };
    tunnel.onerror = function tunnelError(status) {
      errorEncountered = true;
      if (recording.onerror)
        recording.onerror(status.message);
    };
    tunnel.onstatechange = function tunnelStateChanged(state) {
      if (state === Guacamole.Tunnel.State.CLOSED) {
        if (instructionBuffer.length) {
          recordingBlob = new Blob([recordingBlob, instructionBuffer]);
          instructionBuffer = "";
        }
        if (!errorEncountered)
          notifyLoaded();
      }
    };
  }
  var toRelativeTimestamp = function toRelativeTimestamp2(timestamp) {
    if (frames.length === 0)
      return 0;
    return timestamp - frames[0].timestamp;
  };
  var findFrame = function findFrame2(minIndex, maxIndex, timestamp) {
    if (minIndex === maxIndex)
      return minIndex;
    var midIndex = Math.floor((minIndex + maxIndex) / 2);
    var midTimestamp = toRelativeTimestamp(frames[midIndex].timestamp);
    if (timestamp < midTimestamp && midIndex > minIndex)
      return findFrame2(minIndex, midIndex - 1, timestamp);
    if (timestamp > midTimestamp && midIndex < maxIndex)
      return findFrame2(midIndex + 1, maxIndex, timestamp);
    return midIndex;
  };
  var replayFrame = function replayFrame2(index, callback) {
    var frame = frames[index];
    parseBlob(recordingBlob.slice(frame.start, frame.end), function handleInstruction(opcode, args) {
      playbackTunnel.receiveInstruction(opcode, args);
    }, function replayCompleted() {
      if (frame.keyframe && !frame.clientState) {
        playbackClient.exportState(function storeClientState(state) {
          frame.clientState = new Blob([JSON.stringify(state)]);
        });
      }
      currentFrame = index;
      if (callback)
        callback();
    });
  };
  var seekToFrame = function seekToFrame2(index, callback, nextRealTimestamp) {
    abortSeek();
    var thisSeek = activeSeek = {
      aborted: false
    };
    var startIndex = index;
    var continueReplay = function continueReplay2() {
      if (recording.onseek && currentFrame > startIndex) {
        recording.onseek(
          toRelativeTimestamp(frames[currentFrame].timestamp),
          currentFrame - startIndex,
          index - startIndex
        );
      }
      if (thisSeek.aborted)
        return;
      if (currentFrame < index)
        replayFrame(currentFrame + 1, continueReplay2);
      else
        callback();
    };
    var continueAfterRequiredDelay = function continueAfterRequiredDelay2() {
      var delay = nextRealTimestamp ? Math.max(nextRealTimestamp - (/* @__PURE__ */ new Date()).getTime(), 0) : 0;
      if (delay)
        globalThis.setTimeout(continueReplay, delay);
      else
        continueReplay();
    };
    for (; startIndex >= 0; startIndex--) {
      var frame = frames[startIndex];
      if (startIndex === currentFrame)
        break;
      if (frame.clientState) {
        frame.clientState.text().then(function textReady(text) {
          playbackClient.importState(JSON.parse(text));
          currentFrame = startIndex;
          continueAfterRequiredDelay();
        });
        return;
      }
    }
    continueAfterRequiredDelay();
  };
  var abortSeek = function abortSeek2() {
    if (activeSeek) {
      activeSeek.aborted = true;
      activeSeek = null;
    }
  };
  var continuePlayback = function continuePlayback2() {
    if (currentFrame + 1 < frames.length) {
      var next = frames[currentFrame + 1];
      var nextRealTimestamp = next.timestamp - startVideoTimestamp + startRealTimestamp;
      seekToFrame(currentFrame + 1, function frameDelayElapsed() {
        continuePlayback2();
      }, nextRealTimestamp);
    } else
      recording.pause();
  };
  this.onload = null;
  this.onerror = null;
  this.onabort = null;
  this.onprogress = null;
  this.onplay = null;
  this.onpause = null;
  this.onseek = null;
  this.connect = function connect(data) {
    if (tunnel)
      tunnel.connect(data);
  };
  this.disconnect = function disconnect() {
    if (tunnel)
      tunnel.disconnect();
  };
  this.abort = function abort() {
    if (!aborted) {
      aborted = true;
      if (recording.onabort)
        recording.onabort();
      if (tunnel)
        tunnel.disconnect();
    }
  };
  this.getDisplay = function getDisplay() {
    return playbackClient.getDisplay();
  };
  this.isPlaying = function isPlaying() {
    return !!startVideoTimestamp;
  };
  this.getPosition = function getPosition() {
    if (currentFrame === -1)
      return 0;
    return toRelativeTimestamp(frames[currentFrame].timestamp);
  };
  this.getDuration = function getDuration() {
    if (frames.length === 0)
      return 0;
    return toRelativeTimestamp(frames[frames.length - 1].timestamp);
  };
  this.play = function play() {
    if (!recording.isPlaying() && currentFrame + 1 < frames.length) {
      if (recording.onplay)
        recording.onplay();
      var next = frames[currentFrame + 1];
      startVideoTimestamp = next.timestamp;
      startRealTimestamp = (/* @__PURE__ */ new Date()).getTime();
      continuePlayback();
    }
  };
  this.seek = function seek(position, callback) {
    if (frames.length === 0)
      return;
    recording.cancel();
    var originallyPlaying = recording.isPlaying();
    recording.pause();
    seekCallback = function restorePlaybackState() {
      seekCallback = null;
      if (originallyPlaying) {
        recording.play();
        originallyPlaying = null;
      }
      if (callback)
        callback();
    };
    seekToFrame(findFrame(0, frames.length - 1, position), seekCallback);
  };
  this.cancel = function cancel() {
    if (seekCallback) {
      abortSeek();
      seekCallback();
    }
  };
  this.pause = function pause() {
    abortSeek();
    if (recording.isPlaying()) {
      if (recording.onpause)
        recording.onpause();
      startVideoTimestamp = null;
      startRealTimestamp = null;
    }
  };
};
Guacamole.SessionRecording._Frame = function _Frame(timestamp, start, end) {
  this.keyframe = false;
  this.timestamp = timestamp;
  this.start = start;
  this.end = end;
  this.clientState = null;
};
Guacamole.SessionRecording._PlaybackTunnel = function _PlaybackTunnel() {
  var tunnel = this;
  this.connect = function connect(data) {
  };
  this.sendMessage = function sendMessage(elements) {
  };
  this.disconnect = function disconnect() {
  };
  this.receiveInstruction = function receiveInstruction(opcode, args) {
    if (tunnel.oninstruction)
      tunnel.oninstruction(opcode, args);
  };
};
var Guacamole = Guacamole || {};
Guacamole.Status = function(code, message) {
  var guac_status = this;
  this.code = code;
  this.message = message;
  this.isError = function() {
    return guac_status.code < 0 || guac_status.code > 255;
  };
};
Guacamole.Status.Code = {
  /**
   * The operation succeeded.
   *
   * @type {!number}
   */
  "SUCCESS": 0,
  /**
   * The requested operation is unsupported.
   *
   * @type {!number}
   */
  "UNSUPPORTED": 256,
  /**
   * The operation could not be performed due to an internal failure.
   *
   * @type {!number}
   */
  "SERVER_ERROR": 512,
  /**
   * The operation could not be performed as the server is busy.
   *
   * @type {!number}
   */
  "SERVER_BUSY": 513,
  /**
   * The operation could not be performed because the upstream server is not
   * responding.
   *
   * @type {!number}
   */
  "UPSTREAM_TIMEOUT": 514,
  /**
   * The operation was unsuccessful due to an error or otherwise unexpected
   * condition of the upstream server.
   *
   * @type {!number}
   */
  "UPSTREAM_ERROR": 515,
  /**
   * The operation could not be performed as the requested resource does not
   * exist.
   *
   * @type {!number}
   */
  "RESOURCE_NOT_FOUND": 516,
  /**
   * The operation could not be performed as the requested resource is
   * already in use.
   *
   * @type {!number}
   */
  "RESOURCE_CONFLICT": 517,
  /**
   * The operation could not be performed as the requested resource is now
   * closed.
   *
   * @type {!number}
   */
  "RESOURCE_CLOSED": 518,
  /**
   * The operation could not be performed because the upstream server does
   * not appear to exist.
   *
   * @type {!number}
   */
  "UPSTREAM_NOT_FOUND": 519,
  /**
   * The operation could not be performed because the upstream server is not
   * available to service the request.
   *
   * @type {!number}
   */
  "UPSTREAM_UNAVAILABLE": 520,
  /**
   * The session within the upstream server has ended because it conflicted
   * with another session.
   *
   * @type {!number}
   */
  "SESSION_CONFLICT": 521,
  /**
   * The session within the upstream server has ended because it appeared to
   * be inactive.
   *
   * @type {!number}
   */
  "SESSION_TIMEOUT": 522,
  /**
   * The session within the upstream server has been forcibly terminated.
   *
   * @type {!number}
   */
  "SESSION_CLOSED": 523,
  /**
   * The operation could not be performed because bad parameters were given.
   *
   * @type {!number}
   */
  "CLIENT_BAD_REQUEST": 768,
  /**
   * Permission was denied to perform the operation, as the user is not yet
   * authorized (not yet logged in, for example).
   *
   * @type {!number}
   */
  "CLIENT_UNAUTHORIZED": 769,
  /**
   * Permission was denied to perform the operation, and this permission will
   * not be granted even if the user is authorized.
   *
   * @type {!number}
   */
  "CLIENT_FORBIDDEN": 771,
  /**
   * The client took too long to respond.
   *
   * @type {!number}
   */
  "CLIENT_TIMEOUT": 776,
  /**
   * The client sent too much data.
   *
   * @type {!number}
   */
  "CLIENT_OVERRUN": 781,
  /**
   * The client sent data of an unsupported or unexpected type.
   *
   * @type {!number}
   */
  "CLIENT_BAD_TYPE": 783,
  /**
   * The operation failed because the current client is already using too
   * many resources.
   *
   * @type {!number}
   */
  "CLIENT_TOO_MANY": 797
};
Guacamole.Status.Code.fromHTTPCode = function fromHTTPCode(status) {
  switch (status) {
    // HTTP 400 - Bad request
    case 400:
      return Guacamole.Status.Code.CLIENT_BAD_REQUEST;
    // HTTP 403 - Forbidden
    case 403:
      return Guacamole.Status.Code.CLIENT_FORBIDDEN;
    // HTTP 404 - Resource not found
    case 404:
      return Guacamole.Status.Code.RESOURCE_NOT_FOUND;
    // HTTP 429 - Too many requests
    case 429:
      return Guacamole.Status.Code.CLIENT_TOO_MANY;
    // HTTP 503 - Server unavailable
    case 503:
      return Guacamole.Status.Code.SERVER_BUSY;
  }
  return Guacamole.Status.Code.SERVER_ERROR;
};
Guacamole.Status.Code.fromWebSocketCode = function fromWebSocketCode(code) {
  switch (code) {
    // Successful disconnect (no error)
    case 1e3:
      return Guacamole.Status.Code.SUCCESS;
    // Codes which indicate the server is not reachable
    case 1006:
    // Abnormal Closure (also signalled by JavaScript when the connection cannot be opened in the first place)
    case 1015:
      return Guacamole.Status.Code.UPSTREAM_NOT_FOUND;
    // Codes which indicate the server is reachable but busy/unavailable
    case 1001:
    // Going Away
    case 1012:
    // Service Restart
    case 1013:
    // Try Again Later
    case 1014:
      return Guacamole.Status.Code.UPSTREAM_UNAVAILABLE;
  }
  return Guacamole.Status.Code.SERVER_ERROR;
};
var Guacamole = Guacamole || {};
Guacamole.StringReader = function(stream) {
  var guac_reader = this;
  var utf8Parser = new Guacamole.UTF8Parser();
  var array_reader = new Guacamole.ArrayBufferReader(stream);
  array_reader.ondata = function(buffer) {
    var text = utf8Parser.decode(buffer);
    if (guac_reader.ontext)
      guac_reader.ontext(text);
  };
  array_reader.onend = function() {
    if (guac_reader.onend)
      guac_reader.onend();
  };
  this.ontext = null;
  this.onend = null;
};
var Guacamole = Guacamole || {};
Guacamole.StringWriter = function(stream) {
  var guac_writer = this;
  var array_writer = new Guacamole.ArrayBufferWriter(stream);
  var buffer = new Uint8Array(8192);
  var length = 0;
  array_writer.onack = function(status) {
    if (guac_writer.onack)
      guac_writer.onack(status);
  };
  function __expand(bytes) {
    if (length + bytes >= buffer.length) {
      var new_buffer = new Uint8Array((length + bytes) * 2);
      new_buffer.set(buffer);
      buffer = new_buffer;
    }
    length += bytes;
  }
  function __append_utf8(codepoint) {
    var mask;
    var bytes;
    if (codepoint <= 127) {
      mask = 0;
      bytes = 1;
    } else if (codepoint <= 2047) {
      mask = 192;
      bytes = 2;
    } else if (codepoint <= 65535) {
      mask = 224;
      bytes = 3;
    } else if (codepoint <= 2097151) {
      mask = 240;
      bytes = 4;
    } else {
      __append_utf8(65533);
      return;
    }
    __expand(bytes);
    var offset = length - 1;
    for (var i = 1; i < bytes; i++) {
      buffer[offset--] = 128 | codepoint & 63;
      codepoint >>= 6;
    }
    buffer[offset] = mask | codepoint;
  }
  function __encode_utf8(text) {
    for (var i = 0; i < text.length; i++) {
      var codepoint = text.charCodeAt(i);
      __append_utf8(codepoint);
    }
    if (length > 0) {
      var out_buffer = buffer.subarray(0, length);
      length = 0;
      return out_buffer;
    }
  }
  this.sendText = function(text) {
    if (text.length)
      array_writer.sendData(__encode_utf8(text));
  };
  this.sendEnd = function() {
    array_writer.sendEnd();
  };
  this.onack = null;
};
var Guacamole = Guacamole || {};
Guacamole.Touch = function Touch(element) {
  Guacamole.Event.Target.call(this);
  var guacTouch = this;
  var DEFAULT_CONTACT_RADIUS = Math.floor(16 * globalThis.devicePixelRatio);
  this.touches = {};
  this.activeTouches = 0;
  element.addEventListener("touchstart", function touchstart(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var changedTouch = e.changedTouches[i];
      var identifier = changedTouch.identifier;
      if (guacTouch.touches[identifier])
        continue;
      var touch = guacTouch.touches[identifier] = new Guacamole.Touch.State({
        id: identifier,
        radiusX: changedTouch.radiusX || DEFAULT_CONTACT_RADIUS,
        radiusY: changedTouch.radiusY || DEFAULT_CONTACT_RADIUS,
        angle: changedTouch.angle || 0,
        force: changedTouch.force || 1
        /* Within JavaScript changedTouch events, a force of 0.0 indicates the device does not support reporting changedTouch force */
      });
      guacTouch.activeTouches++;
      touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
      guacTouch.dispatch(new Guacamole.Touch.Event("touchmove", e, touch));
    }
  }, false);
  element.addEventListener("touchmove", function touchstart(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var changedTouch = e.changedTouches[i];
      var identifier = changedTouch.identifier;
      var touch = guacTouch.touches[identifier];
      if (!touch)
        continue;
      if (changedTouch.force)
        touch.force = changedTouch.force;
      touch.angle = changedTouch.angle || 0;
      touch.radiusX = changedTouch.radiusX || DEFAULT_CONTACT_RADIUS;
      touch.radiusY = changedTouch.radiusY || DEFAULT_CONTACT_RADIUS;
      touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
      guacTouch.dispatch(new Guacamole.Touch.Event("touchmove", e, touch));
    }
  }, false);
  element.addEventListener("touchend", function touchstart(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var changedTouch = e.changedTouches[i];
      var identifier = changedTouch.identifier;
      var touch = guacTouch.touches[identifier];
      if (!touch)
        continue;
      delete guacTouch.touches[identifier];
      guacTouch.activeTouches--;
      touch.force = 0;
      touch.fromClientPosition(element, changedTouch.clientX, changedTouch.clientY);
      guacTouch.dispatch(new Guacamole.Touch.Event("touchend", e, touch));
    }
  }, false);
};
Guacamole.Touch.State = function State2(template) {
  template = template || {};
  Guacamole.Position.call(this, template);
  this.id = template.id || 0;
  this.radiusX = template.radiusX || 0;
  this.radiusY = template.radiusY || 0;
  this.angle = template.angle || 0;
  this.force = template.force || 1;
};
Guacamole.Touch.Event = function TouchEvent(type, event, state) {
  Guacamole.Event.DOMEvent.call(this, type, [event]);
  this.state = state;
};
var Guacamole = Guacamole || {};
Guacamole.Tunnel = function() {
  this.connect = function(data) {
  };
  this.disconnect = function() {
  };
  this.sendMessage = function(elements) {
  };
  this.setState = function(state) {
    if (state !== this.state) {
      this.state = state;
      if (this.onstatechange)
        this.onstatechange(state);
    }
  };
  this.setUUID = function setUUID(uuid) {
    this.uuid = uuid;
    if (this.onuuid)
      this.onuuid(uuid);
  };
  this.isConnected = function isConnected() {
    return this.state === Guacamole.Tunnel.State.OPEN || this.state === Guacamole.Tunnel.State.UNSTABLE;
  };
  this.state = Guacamole.Tunnel.State.CLOSED;
  this.receiveTimeout = 15e3;
  this.unstableThreshold = 1500;
  this.uuid = null;
  this.onuuid = null;
  this.onerror = null;
  this.onstatechange = null;
  this.oninstruction = null;
};
Guacamole.Tunnel.INTERNAL_DATA_OPCODE = "";
Guacamole.Tunnel.State = {
  /**
   * A connection is in pending. It is not yet known whether connection was
   * successful.
   * 
   * @type {!number}
   */
  "CONNECTING": 0,
  /**
   * Connection was successful, and data is being received.
   * 
   * @type {!number}
   */
  "OPEN": 1,
  /**
   * The connection is closed. Connection may not have been successful, the
   * tunnel may have been explicitly closed by either side, or an error may
   * have occurred.
   * 
   * @type {!number}
   */
  "CLOSED": 2,
  /**
   * The connection is open, but communication through the tunnel appears to
   * be disrupted, and the connection may close as a result.
   *
   * @type {!number}
   */
  "UNSTABLE": 3
};
Guacamole.HTTPTunnel = function(tunnelURL, crossDomain, extraTunnelHeaders) {
  var tunnel = this;
  var TUNNEL_CONNECT = tunnelURL + "?connect";
  var TUNNEL_READ = tunnelURL + "?read:";
  var TUNNEL_WRITE = tunnelURL + "?write:";
  var POLLING_ENABLED = 1;
  var POLLING_DISABLED = 0;
  var pollingMode = POLLING_ENABLED;
  var sendingMessages = false;
  var outputMessageBuffer = "";
  var withCredentials = !!crossDomain;
  var receive_timeout = null;
  var unstableTimeout = null;
  var pingInterval = null;
  var PING_FREQUENCY = 500;
  var extraHeaders = extraTunnelHeaders || {};
  var TUNNEL_TOKEN_HEADER = "Guacamole-Tunnel-Token";
  var tunnelSessionToken = null;
  function addExtraHeaders(request, headers) {
    for (var name in headers) {
      request.setRequestHeader(name, headers[name]);
    }
  }
  var resetTimers = function resetTimers2() {
    globalThis.clearTimeout(receive_timeout);
    globalThis.clearTimeout(unstableTimeout);
    if (tunnel.state === Guacamole.Tunnel.State.UNSTABLE)
      tunnel.setState(Guacamole.Tunnel.State.OPEN);
    receive_timeout = globalThis.setTimeout(function() {
      close_tunnel(new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_TIMEOUT, "Server timeout."));
    }, tunnel.receiveTimeout);
    unstableTimeout = globalThis.setTimeout(function() {
      tunnel.setState(Guacamole.Tunnel.State.UNSTABLE);
    }, tunnel.unstableThreshold);
  };
  function close_tunnel(status) {
    globalThis.clearTimeout(receive_timeout);
    globalThis.clearTimeout(unstableTimeout);
    globalThis.clearInterval(pingInterval);
    if (tunnel.state === Guacamole.Tunnel.State.CLOSED)
      return;
    if (status.code !== Guacamole.Status.Code.SUCCESS && tunnel.onerror) {
      if (tunnel.state === Guacamole.Tunnel.State.CONNECTING || status.code !== Guacamole.Status.Code.RESOURCE_NOT_FOUND)
        tunnel.onerror(status);
    }
    sendingMessages = false;
    tunnel.setState(Guacamole.Tunnel.State.CLOSED);
  }
  this.sendMessage = function() {
    if (!tunnel.isConnected())
      return;
    if (!arguments.length)
      return;
    outputMessageBuffer += Guacamole.Parser.toInstruction(arguments);
    if (!sendingMessages)
      sendPendingMessages();
  };
  function sendPendingMessages() {
    if (!tunnel.isConnected())
      return;
    if (outputMessageBuffer.length > 0) {
      sendingMessages = true;
      var message_xmlhttprequest = new XMLHttpRequest();
      message_xmlhttprequest.open("POST", TUNNEL_WRITE + tunnel.uuid);
      message_xmlhttprequest.withCredentials = withCredentials;
      addExtraHeaders(message_xmlhttprequest, extraHeaders);
      message_xmlhttprequest.setRequestHeader("Content-type", "application/octet-stream");
      message_xmlhttprequest.setRequestHeader(TUNNEL_TOKEN_HEADER, tunnelSessionToken);
      message_xmlhttprequest.onreadystatechange = function() {
        if (message_xmlhttprequest.readyState === 4) {
          resetTimers();
          if (message_xmlhttprequest.status !== 200)
            handleHTTPTunnelError(message_xmlhttprequest);
          else
            sendPendingMessages();
        }
      };
      message_xmlhttprequest.send(outputMessageBuffer);
      outputMessageBuffer = "";
    } else
      sendingMessages = false;
  }
  function handleHTTPTunnelError(xmlhttprequest) {
    var code = parseInt(xmlhttprequest.getResponseHeader("Guacamole-Status-Code"));
    if (code) {
      var message = xmlhttprequest.getResponseHeader("Guacamole-Error-Message");
      close_tunnel(new Guacamole.Status(code, message));
    } else if (xmlhttprequest.status)
      close_tunnel(new Guacamole.Status(
        Guacamole.Status.Code.fromHTTPCode(xmlhttprequest.status),
        xmlhttprequest.statusText
      ));
    else
      close_tunnel(new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_NOT_FOUND));
  }
  function handleResponse(xmlhttprequest) {
    var interval = null;
    var nextRequest = null;
    var dataUpdateEvents = 0;
    var parser = new Guacamole.Parser();
    parser.oninstruction = function instructionReceived(opcode, args) {
      if (opcode === Guacamole.Tunnel.INTERNAL_DATA_OPCODE && args.length === 0) {
        parser = new Guacamole.Parser();
        parser.oninstruction = instructionReceived;
        if (interval)
          clearInterval(interval);
        xmlhttprequest.onreadystatechange = null;
        xmlhttprequest.abort();
        if (nextRequest)
          handleResponse(nextRequest);
      } else if (opcode !== Guacamole.Tunnel.INTERNAL_DATA_OPCODE && tunnel.oninstruction)
        tunnel.oninstruction(opcode, args);
    };
    function parseResponse() {
      if (!tunnel.isConnected()) {
        if (interval !== null)
          clearInterval(interval);
        return;
      }
      if (xmlhttprequest.readyState < 2) return;
      var status;
      try {
        status = xmlhttprequest.status;
      } catch (e) {
        status = 200;
      }
      if (!nextRequest && status === 200)
        nextRequest = makeRequest();
      if (xmlhttprequest.readyState === 3 || xmlhttprequest.readyState === 4) {
        resetTimers();
        if (pollingMode === POLLING_ENABLED) {
          if (xmlhttprequest.readyState === 3 && !interval)
            interval = setInterval(parseResponse, 30);
          else if (xmlhttprequest.readyState === 4 && interval)
            clearInterval(interval);
        }
        if (xmlhttprequest.status === 0) {
          tunnel.disconnect();
          return;
        } else if (xmlhttprequest.status !== 200) {
          handleHTTPTunnelError(xmlhttprequest);
          return;
        }
        var current;
        try {
          current = xmlhttprequest.responseText;
        } catch (e) {
          return;
        }
        try {
          parser.receive(current, true);
        } catch (e) {
          close_tunnel(new Guacamole.Status(Guacamole.Status.Code.SERVER_ERROR, e.message));
          return;
        }
      }
    }
    if (pollingMode === POLLING_ENABLED) {
      xmlhttprequest.onreadystatechange = function() {
        if (xmlhttprequest.readyState === 3) {
          dataUpdateEvents++;
          if (dataUpdateEvents >= 2) {
            pollingMode = POLLING_DISABLED;
            xmlhttprequest.onreadystatechange = parseResponse;
          }
        }
        parseResponse();
      };
    } else
      xmlhttprequest.onreadystatechange = parseResponse;
    parseResponse();
  }
  var request_id = 0;
  function makeRequest() {
    var xmlhttprequest = new XMLHttpRequest();
    xmlhttprequest.open("GET", TUNNEL_READ + tunnel.uuid + ":" + request_id++);
    xmlhttprequest.setRequestHeader(TUNNEL_TOKEN_HEADER, tunnelSessionToken);
    xmlhttprequest.withCredentials = withCredentials;
    addExtraHeaders(xmlhttprequest, extraHeaders);
    xmlhttprequest.send(null);
    return xmlhttprequest;
  }
  this.connect = function(data) {
    resetTimers();
    tunnel.setState(Guacamole.Tunnel.State.CONNECTING);
    var connect_xmlhttprequest = new XMLHttpRequest();
    connect_xmlhttprequest.onreadystatechange = function() {
      if (connect_xmlhttprequest.readyState !== 4)
        return;
      if (connect_xmlhttprequest.status !== 200) {
        handleHTTPTunnelError(connect_xmlhttprequest);
        return;
      }
      resetTimers();
      tunnel.setUUID(connect_xmlhttprequest.responseText);
      tunnelSessionToken = connect_xmlhttprequest.getResponseHeader(TUNNEL_TOKEN_HEADER);
      if (!tunnelSessionToken) {
        close_tunnel(new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_NOT_FOUND));
        return;
      }
      tunnel.setState(Guacamole.Tunnel.State.OPEN);
      pingInterval = setInterval(function sendPing() {
        tunnel.sendMessage("nop");
      }, PING_FREQUENCY);
      handleResponse(makeRequest());
    };
    connect_xmlhttprequest.open("POST", TUNNEL_CONNECT, true);
    connect_xmlhttprequest.withCredentials = withCredentials;
    addExtraHeaders(connect_xmlhttprequest, extraHeaders);
    connect_xmlhttprequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=UTF-8");
    connect_xmlhttprequest.send(data);
  };
  this.disconnect = function() {
    close_tunnel(new Guacamole.Status(Guacamole.Status.Code.SUCCESS, "Manually closed."));
  };
};
Guacamole.HTTPTunnel.prototype = new Guacamole.Tunnel();
Guacamole.WebSocketTunnel = function(tunnelURL) {
  var tunnel = this;
  var parser = null;
  var socket = null;
  var receive_timeout = null;
  var unstableTimeout = null;
  var pingTimeout = null;
  var ws_protocol = {
    "http:": "ws:",
    "https:": "wss:"
  };
  var PING_FREQUENCY = 500;
  var lastSentPing = 0;
  if (tunnelURL.substring(0, 3) !== "ws:" && tunnelURL.substring(0, 4) !== "wss:") {
    var protocol = ws_protocol[globalThis.location.protocol];
    if (tunnelURL.substring(0, 1) === "/")
      tunnelURL = protocol + "//" + globalThis.location.host + tunnelURL;
    else {
      var slash = globalThis.location.pathname.lastIndexOf("/");
      var path = globalThis.location.pathname.substring(0, slash + 1);
      tunnelURL = protocol + "//" + globalThis.location.host + path + tunnelURL;
    }
  }
  var sendPing = function sendPing2() {
    var currentTime = (/* @__PURE__ */ new Date()).getTime();
    tunnel.sendMessage(Guacamole.Tunnel.INTERNAL_DATA_OPCODE, "ping", currentTime);
    lastSentPing = currentTime;
  };
  var resetTimers = function resetTimers2() {
    globalThis.clearTimeout(receive_timeout);
    globalThis.clearTimeout(unstableTimeout);
    globalThis.clearTimeout(pingTimeout);
    if (tunnel.state === Guacamole.Tunnel.State.UNSTABLE)
      tunnel.setState(Guacamole.Tunnel.State.OPEN);
    receive_timeout = globalThis.setTimeout(function() {
      close_tunnel(new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_TIMEOUT, "Server timeout."));
    }, tunnel.receiveTimeout);
    unstableTimeout = globalThis.setTimeout(function() {
      tunnel.setState(Guacamole.Tunnel.State.UNSTABLE);
    }, tunnel.unstableThreshold);
    var currentTime = (/* @__PURE__ */ new Date()).getTime();
    var pingDelay = Math.max(lastSentPing + PING_FREQUENCY - currentTime, 0);
    if (pingDelay > 0)
      pingTimeout = globalThis.setTimeout(sendPing, pingDelay);
    else
      sendPing();
  };
  function close_tunnel(status) {
    globalThis.clearTimeout(receive_timeout);
    globalThis.clearTimeout(unstableTimeout);
    globalThis.clearTimeout(pingTimeout);
    if (tunnel.state === Guacamole.Tunnel.State.CLOSED)
      return;
    if (status.code !== Guacamole.Status.Code.SUCCESS && tunnel.onerror)
      tunnel.onerror(status);
    tunnel.setState(Guacamole.Tunnel.State.CLOSED);
    socket.close();
  }
  this.sendMessage = function(elements) {
    if (!tunnel.isConnected())
      return;
    if (!arguments.length)
      return;
    socket.send(Guacamole.Parser.toInstruction(arguments));
  };
  this.connect = function(data) {
    resetTimers();
    tunnel.setState(Guacamole.Tunnel.State.CONNECTING);
    parser = new Guacamole.Parser();
    parser.oninstruction = function instructionReceived(opcode, args) {
      if (tunnel.uuid === null) {
        if (opcode === Guacamole.Tunnel.INTERNAL_DATA_OPCODE && args.length === 1)
          tunnel.setUUID(args[0]);
        tunnel.setState(Guacamole.Tunnel.State.OPEN);
      }
      if (opcode !== Guacamole.Tunnel.INTERNAL_DATA_OPCODE && tunnel.oninstruction)
        tunnel.oninstruction(opcode, args);
    };
    socket = new WebSocket(tunnelURL + "?" + data, "guacamole");
    socket.onopen = function(event) {
      resetTimers();
    };
    socket.onclose = function(event) {
      if (event.reason)
        close_tunnel(new Guacamole.Status(parseInt(event.reason), event.reason));
      else if (event.code)
        close_tunnel(new Guacamole.Status(Guacamole.Status.Code.fromWebSocketCode(event.code)));
      else
        close_tunnel(new Guacamole.Status(Guacamole.Status.Code.UPSTREAM_NOT_FOUND));
    };
    socket.onmessage = function(event) {
      resetTimers();
      try {
        parser.receive(event.data);
      } catch (e) {
        close_tunnel(new Guacamole.Status(Guacamole.Status.Code.SERVER_ERROR, e.message));
      }
    };
  };
  this.disconnect = function() {
    close_tunnel(new Guacamole.Status(Guacamole.Status.Code.SUCCESS, "Manually closed."));
  };
};
Guacamole.WebSocketTunnel.prototype = new Guacamole.Tunnel();
Guacamole.ChainedTunnel = function(tunnelChain) {
  var chained_tunnel = this;
  var connect_data;
  var tunnels = [];
  var committedTunnel = null;
  for (var i = 0; i < arguments.length; i++)
    tunnels.push(arguments[i]);
  function attach(tunnel) {
    chained_tunnel.disconnect = tunnel.disconnect;
    chained_tunnel.sendMessage = tunnel.sendMessage;
    var failTunnel = function failTunnel2(status) {
      if (status && status.code === Guacamole.Status.Code.UPSTREAM_TIMEOUT) {
        tunnels = [];
        return null;
      }
      var next_tunnel = tunnels.shift();
      if (next_tunnel) {
        tunnel.onerror = null;
        tunnel.oninstruction = null;
        tunnel.onstatechange = null;
        attach(next_tunnel);
      }
      return next_tunnel;
    };
    function commit_tunnel() {
      tunnel.onstatechange = chained_tunnel.onstatechange;
      tunnel.oninstruction = chained_tunnel.oninstruction;
      tunnel.onerror = chained_tunnel.onerror;
      if (tunnel.uuid)
        chained_tunnel.setUUID(tunnel.uuid);
      tunnel.onuuid = function uuidReceived(uuid) {
        chained_tunnel.setUUID(uuid);
      };
      committedTunnel = tunnel;
    }
    tunnel.onstatechange = function(state) {
      switch (state) {
        // If open, use this tunnel from this point forward.
        case Guacamole.Tunnel.State.OPEN:
          commit_tunnel();
          if (chained_tunnel.onstatechange)
            chained_tunnel.onstatechange(state);
          break;
        // If closed, mark failure, attempt next tunnel
        case Guacamole.Tunnel.State.CLOSED:
          if (!failTunnel() && chained_tunnel.onstatechange)
            chained_tunnel.onstatechange(state);
          break;
      }
    };
    tunnel.oninstruction = function(opcode, elements) {
      commit_tunnel();
      if (chained_tunnel.oninstruction)
        chained_tunnel.oninstruction(opcode, elements);
    };
    tunnel.onerror = function(status) {
      if (!failTunnel(status) && chained_tunnel.onerror)
        chained_tunnel.onerror(status);
    };
    tunnel.connect(connect_data);
  }
  this.connect = function(data) {
    connect_data = data;
    var next_tunnel = committedTunnel ? committedTunnel : tunnels.shift();
    if (next_tunnel)
      attach(next_tunnel);
    else if (chained_tunnel.onerror)
      chained_tunnel.onerror(Guacamole.Status.Code.SERVER_ERROR, "No tunnels to try.");
  };
};
Guacamole.ChainedTunnel.prototype = new Guacamole.Tunnel();
Guacamole.StaticHTTPTunnel = function StaticHTTPTunnel(url, crossDomain, extraTunnelHeaders) {
  var tunnel = this;
  var abortController = null;
  var extraHeaders = extraTunnelHeaders || {};
  this.size = null;
  this.sendMessage = function sendMessage(elements) {
  };
  this.connect = function connect(data) {
    tunnel.disconnect();
    tunnel.setState(Guacamole.Tunnel.State.CONNECTING);
    var parser = new Guacamole.Parser();
    var utf8Parser = new Guacamole.UTF8Parser();
    parser.oninstruction = function instructionReceived(opcode, args) {
      if (tunnel.oninstruction)
        tunnel.oninstruction(opcode, args);
    };
    abortController = new AbortController();
    fetch(url, {
      headers: extraHeaders,
      credentials: crossDomain ? "include" : "same-origin",
      signal: abortController.signal
    }).then(function gotResponse(response) {
      if (!response.ok) {
        if (tunnel.onerror)
          tunnel.onerror(new Guacamole.Status(
            Guacamole.Status.Code.fromHTTPCode(response.status),
            response.statusText
          ));
        tunnel.disconnect();
        return;
      }
      tunnel.size = response.headers.get("Content-Length");
      tunnel.setState(Guacamole.Tunnel.State.OPEN);
      var reader = response.body.getReader();
      var processReceivedText = function processReceivedText2(result) {
        if (result.done) {
          tunnel.disconnect();
          return;
        }
        parser.receive(utf8Parser.decode(result.value));
        reader.read().then(processReceivedText2);
      };
      reader.read().then(processReceivedText);
    });
  };
  this.disconnect = function disconnect() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    tunnel.setState(Guacamole.Tunnel.State.CLOSED);
  };
};
Guacamole.StaticHTTPTunnel.prototype = new Guacamole.Tunnel();
var Guacamole = Guacamole || {};
Guacamole.UTF8Parser = function UTF8Parser() {
  var bytesRemaining = 0;
  var codepoint = 0;
  this.decode = function decode(buffer) {
    var text = "";
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) {
      var value = bytes[i];
      if (bytesRemaining === 0) {
        if ((value | 127) === 127)
          text += String.fromCharCode(value);
        else if ((value | 31) === 223) {
          codepoint = value & 31;
          bytesRemaining = 1;
        } else if ((value | 15) === 239) {
          codepoint = value & 15;
          bytesRemaining = 2;
        } else if ((value | 7) === 247) {
          codepoint = value & 7;
          bytesRemaining = 3;
        } else
          text += "\uFFFD";
      } else if ((value | 63) === 191) {
        codepoint = codepoint << 6 | value & 63;
        bytesRemaining--;
        if (bytesRemaining === 0)
          text += String.fromCharCode(codepoint);
      } else {
        bytesRemaining = 0;
        text += "\uFFFD";
      }
    }
    return text;
  };
};
var Guacamole = Guacamole || {};
Guacamole.API_VERSION = "1.5.4";
var Guacamole = Guacamole || {};
Guacamole.VideoPlayer = function VideoPlayer() {
  this.sync = function sync() {
  };
};
Guacamole.VideoPlayer.isSupportedType = function isSupportedType5(mimetype) {
  return false;
};
Guacamole.VideoPlayer.getSupportedTypes = function getSupportedTypes5() {
  return [];
};
Guacamole.VideoPlayer.getInstance = function getInstance3(stream, layer, mimetype) {
  return null;
};
export const ArrayBufferReader  = Guacamole.ArrayBufferReader ;
export const ArrayBufferWriter  = Guacamole.ArrayBufferWriter ;
export const AudioContextFactory  = Guacamole.AudioContextFactory ;
export const AudioPlayer  = Guacamole.AudioPlayer ;
export const RawAudioPlayer  = Guacamole.RawAudioPlayer ;
export const AudioRecorder  = Guacamole.AudioRecorder ;
export const RawAudioRecorder  = Guacamole.RawAudioRecorder ;
export const BlobReader  = Guacamole.BlobReader ;
export const BlobWriter  = Guacamole.BlobWriter ;
export const Client  = Guacamole.Client ;
export const DataURIReader  = Guacamole.DataURIReader ;
export const Display  = Guacamole.Display ;
export const Event  = Guacamole.Event ;
export const InputSink  = Guacamole.InputSink ;
export const InputStream  = Guacamole.InputStream ;
export const IntegerPool  = Guacamole.IntegerPool ;
export const JSONReader  = Guacamole.JSONReader ;
export const Keyboard  = Guacamole.Keyboard ;
export const Layer  = Guacamole.Layer ;
export const Mouse  = Guacamole.Mouse ;
export const Object  = Guacamole.Object ;
export const OnScreenKeyboard  = Guacamole.OnScreenKeyboard ;
export const OutputStream  = Guacamole.OutputStream ;
export const Parser  = Guacamole.Parser ;
export const Position  = Guacamole.Position ;
export const RawAudioFormat  = Guacamole.RawAudioFormat ;
export const SessionRecording  = Guacamole.SessionRecording ;
export const Status  = Guacamole.Status ;
export const StringReader  = Guacamole.StringReader ;
export const StringWriter  = Guacamole.StringWriter ;
export const Touch  = Guacamole.Touch ;
export const Tunnel  = Guacamole.Tunnel ;
export const HTTPTunnel  = Guacamole.HTTPTunnel ;
export const WebSocketTunnel  = Guacamole.WebSocketTunnel ;
export const ChainedTunnel  = Guacamole.ChainedTunnel ;
export const StaticHTTPTunnel  = Guacamole.StaticHTTPTunnel ;
export const UTF8Parser  = Guacamole.UTF8Parser ;
export const API_VERSION  = Guacamole.API_VERSION ;
export const VideoPlayer  = Guacamole.VideoPlayer ;
export default Guacamole;
