// Tests mainly implemented by Ethan Van Der Heijden at:
// https://github.com/ethan-vanderheijden/guacamole-common-js-esm/blob/595c175810319d6a838e98ec07e468105b525c7e/test/test_exports.js
import assert from 'node:assert';
import test from 'node:test';

test('Exports', async (t) => {
    const exports = await import('../../guac-dist/dist/index.js');

    await test('ArrayBufferReader', async (t) => {
        assert(exports.ArrayBufferReader instanceof Function);
    });
    
    await test('ArrayBufferWriter', async (t) => {
        const ArrayBufferWriter = exports.ArrayBufferWriter;
        assert(ArrayBufferWriter instanceof Function);
        assert.strictEqual(typeof ArrayBufferWriter.DEFAULT_BLOB_LENGTH, 'number');
    });
    
    await test('AudioContextFactory', async (t) => {
        const AudioContextFactory = exports.AudioContextFactory;
        assert('singleton' in AudioContextFactory);
        assert('getAudioContext' in AudioContextFactory);
    });
    
    await test('AudioPlayer', async (t) => {
        const AudioPlayer = exports.AudioPlayer;
        const RawAudioPlayer = exports.RawAudioPlayer;
        assert(AudioPlayer instanceof Function);
        assert(AudioPlayer.isSupportedType instanceof Function);
        assert(AudioPlayer.getSupportedTypes instanceof Function);
        assert(AudioPlayer.getInstance instanceof Function);
        assert(RawAudioPlayer instanceof Function);
        assert(RawAudioPlayer.isSupportedType instanceof Function);
        assert(RawAudioPlayer.getSupportedTypes instanceof Function);
        assert(RawAudioPlayer.prototype instanceof AudioPlayer);
    });
    
    await test('AudioRecorder', async (t) => {
        const AudioRecorder = exports.AudioRecorder;
        const RawAudioRecorder = exports.RawAudioRecorder;
        assert(AudioRecorder instanceof Function);
        assert(AudioRecorder.isSupportedType instanceof Function);
        assert(AudioRecorder.getSupportedTypes instanceof Function);
        assert(AudioRecorder.getInstance instanceof Function);
        assert(RawAudioRecorder instanceof Function);
        assert(RawAudioRecorder.isSupportedType instanceof Function);
        assert(RawAudioRecorder.getSupportedTypes instanceof Function);
        assert(RawAudioRecorder.prototype instanceof AudioRecorder);
    });
    
    await test('BlobReader', async (t) => {
        assert(exports.BlobReader instanceof Function);
    });
    
    await test('BlobWriter', async (t) => {
        assert(exports.BlobWriter instanceof Function);
    });
    
    await test('Client', async (t) => {
        const Client = exports.Client;
        assert(Client instanceof Function);
        assert.strictEqual(Client.DefaultTransferFunction.constructor, Object);
        assert.strictEqual(Client.Message.constructor, Object);
    })
    
    await test('DataURIReader', async (t) => {
        assert(exports.DataURIReader instanceof Function);
    });
    
    await test('Display', async (t) => {
        const Display = exports.Display;
        assert(Display instanceof Function);
        assert(Display.VisibleLayer instanceof Function);
    });
    
    await test('Event', async (t) => {
        const Event = exports.Event;
        assert(Event instanceof Function);
        assert(Event.DOMEvent instanceof Function);
        assert(Event.DOMEvent.cancelEvent instanceof Function);
        assert(Event.Target instanceof Function);
    });
    
    await test('InputSink', async (t) => {
        assert(exports.InputSink instanceof Function);
    });
    
    await test('InputStream', async (t) => {
        assert(exports.InputStream instanceof Function);
    });
    
    await test('IntegerPool', async (t) => {
        assert(exports.IntegerPool instanceof Function);
    });
    
    await test('JSONReader', async (t) => {
        assert(exports.JSONReader instanceof Function);
    });
    
    await test('Keyboard', async (t) => {
        const Keyboard = exports.Keyboard;
        assert(Keyboard instanceof Function);
        assert(Keyboard.ModifierState instanceof Function);
        assert(Keyboard.ModifierState.fromKeyboardEvent instanceof Function);
    });
    
    // await test('KeyEventInterpreter', async (t) => {
    //     const KeyEventInterpreter = exports.KeyEventInterpreter;
    //     assert(KeyEventInterpreter instanceof Function);
    //     assert(KeyEventInterpreter.KeyDefinition instanceof Function);
    //     assert(KeyEventInterpreter.KeyEvent instanceof Function);
    // });
    
    await test('Layer', async (t) => {
        const Layer = exports.Layer;
        assert(Layer instanceof Function);
        assert(Layer.Pixel instanceof Function);
        const masks = ['ROUT', 'ATOP', 'XOR', 'ROVER', 'OVER', 'PLUS', 'RIN', 'IN', 'OUT', 'RATOP', 'SRC'];
        for(const mask of masks) {
            assert(mask in Layer);
        }
    });
    
    await test('Mouse', async (t) => {
        const Mouse = exports.Mouse;
        assert(Mouse instanceof Function);
        assert(Mouse.State instanceof Function);
        assert.strictEqual(Mouse.State.Buttons.constructor, Object);
        assert(Mouse.Event instanceof Function);
        assert(Mouse.Event.Target instanceof Function);
        assert(Mouse.Touchpad instanceof Function);
        assert(Mouse.Touchscreen instanceof Function);
    });
    
    await test('Object', async (t) => {
        const Object = exports.Object;
        assert(Object instanceof Function);
        assert.strictEqual(typeof Object.ROOT_STREAM, 'string');
        assert.strictEqual(typeof Object.STREAM_INDEX_MIMETYPE, 'string');
    });
    
    await test('OnScreenKeyboard', async (t) => {
        const OnScreenKeyboard = exports.OnScreenKeyboard;
        assert(OnScreenKeyboard instanceof Function);
        assert(OnScreenKeyboard.Layout instanceof Function);
        assert(OnScreenKeyboard.Key instanceof Function);
    });
    
    await test('OutputStream', async (t) => {
        assert(exports.OutputStream instanceof Function);
    });
    
    await test('Parser', async (t) => {
        const Parser = exports.Parser;
        assert(Parser instanceof Function);
        assert(Parser.codePointCount instanceof Function);
        assert(Parser.toInstruction instanceof Function);
    });
    
    await test('Position', async (t) => {
        const Position = exports.Position;
        assert(Position instanceof Function);
        assert(Position.fromClientPosition instanceof Function);
    });
    
    await test('RawAudioFormat', async (t) => {
        const RawAudioFormat = exports.RawAudioFormat;
        assert(RawAudioFormat instanceof Function);
        assert(RawAudioFormat.parse instanceof Function);
    });
    
    await test('SessionRecording', async (t) => {
        assert(exports.SessionRecording instanceof Function);
    });
    
    await test('Status', async (t) => {
        const Status = exports.Status;
        assert(Status instanceof Function);
        assert.strictEqual(Status.Code.constructor, Object);
        assert(Status.Code.fromHTTPCode instanceof Function);
        assert(Status.Code.fromWebSocketCode instanceof Function);
    });
    
    await test('StringReader', async (t) => {
        assert(exports.StringReader instanceof Function);
    });
    
    await test('StringWriter', async (t) => {
        assert(exports.StringWriter instanceof Function);
    });
    
    await test('Touch', async (t) => {
        const Touch = exports.Touch;
        assert(Touch instanceof Function);
        assert(Touch.State instanceof Function);
        assert(Touch.Event instanceof Function);
    });
    
    await test('Tunnel', async (t) => {
        const Tunnel = exports.Tunnel;
        const HTTPTunnel = exports.HTTPTunnel;
        const WebSocketTunnel = exports.WebSocketTunnel;
        const ChainedTunnel = exports.ChainedTunnel;
        const StaticHTTPTunnel = exports.StaticHTTPTunnel;

        assert(Tunnel instanceof Function);
        assert.strictEqual(typeof Tunnel.INTERNAL_DATA_OPCODE, 'string');
        assert.strictEqual(Tunnel.State.constructor, Object);
        assert(HTTPTunnel instanceof Function);
        assert(HTTPTunnel.prototype instanceof Tunnel);
        assert(WebSocketTunnel instanceof Function);
        assert(WebSocketTunnel.prototype instanceof Tunnel);
        assert(ChainedTunnel instanceof Function);
        assert(ChainedTunnel.prototype instanceof Tunnel);
        assert(StaticHTTPTunnel instanceof Function);
        assert(StaticHTTPTunnel.prototype instanceof Tunnel);
    });
    
    await test('UTF8Parser', async (t) => {
        assert(exports.UTF8Parser instanceof Function);
    });
    
    await test('Version', async (t) => {
        assert.strictEqual(typeof exports.API_VERSION, 'string');
    });
    
    await test('VideoPlayer', async (t) => {
        const VideoPlayer = exports.VideoPlayer;
        assert(VideoPlayer instanceof Function);
        assert(VideoPlayer.isSupportedType instanceof Function);
        assert(VideoPlayer.getSupportedTypes instanceof Function);
        assert(VideoPlayer.getInstance instanceof Function);
    });
});