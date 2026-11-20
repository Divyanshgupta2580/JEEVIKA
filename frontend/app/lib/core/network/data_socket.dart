import "dart:async";
import "dart:convert";
import "dart:math";

import "package:web_socket_channel/web_socket_channel.dart";

import "api_config.dart";

class DataSocket {
  static final instance = DataSocket();
  static const _protocol = "jeevika.data.v1";

  String? _token;
  void Function()? _onUnauthorized;
  WebSocketChannel? _channel;
  StreamSubscription<Object?>? _subscription;
  Timer? _reconnect;
  bool _ready = false;
  int _sequence = 0;
  int _retryDelay = 250;
  final _pending = <String, _Request>{};

  void setSession(String? token, {void Function()? onUnauthorized}) {
    if (_token == token) return;
    _token = token;
    _onUnauthorized = onUnauthorized;
    _retryDelay = 250;
    _reconnect?.cancel();
    _reconnect = null;
    _detach();
    final pending = _pending.values.toList();
    _pending.clear();
    for (final request in pending) {
      request.fail("Session ended");
    }
  }

  Future<Object?> request(
    String token,
    String method,
    String path, {
    Object? body,
  }) {
    if (_token != token || token.isEmpty) {
      return Future.error(StateError("An authenticated session is required"));
    }
    final id = "${++_sequence}";
    final completer = Completer<Object?>();
    final timer = Timer(const Duration(seconds: 4), () {
      _pending.remove(id)?.fail("WebSocket request timed out");
    });
    _pending[id] = _Request(
      jsonEncode({"id": id, "method": method, "path": path, "body": ?body}),
      completer,
      timer,
    );
    if (_ready) {
      _flush(_channel!);
    } else {
      unawaited(_connect());
    }
    return completer.future;
  }

  Future<void> _connect() async {
    final token = _token;
    if (token == null || _channel != null || _reconnect != null) return;

    final api = Uri.parse(ApiConfig.baseUrl);
    final uri = api.replace(
      scheme: api.scheme == "https" ? "wss" : "ws",
      path: "${api.path.replaceFirst(RegExp(r'/$'), '')}/socket",
    );
    final WebSocketChannel channel;
    try {
      channel = WebSocketChannel.connect(
        uri,
        protocols: [_protocol, "session.$token"],
      );
    } catch (_) {
      _scheduleReconnect();
      return;
    }
    _channel = channel;
    _subscription = channel.stream.listen(
      (message) => _receive(channel, message),
      onError: (Object _) => _disconnect(channel),
      onDone: () => _disconnect(channel),
    );
    try {
      await channel.ready.timeout(const Duration(seconds: 4));
      if (_channel != channel) return;
      _retryDelay = 250;
      _ready = true;
      _flush(channel);
    } catch (_) {
      _disconnect(channel);
    }
  }

  void _receive(WebSocketChannel channel, Object? message) {
    if (_channel != channel || message is! String) return;
    try {
      final response = jsonDecode(message) as Map<String, Object?>;
      final request = _pending.remove(response["id"]);
      if (request == null) return;
      final status = response["status"];
      if (status is int && status >= 200 && status < 300) {
        request.complete(response["body"]);
      } else {
        request.fail("WebSocket request failed ($status)");
        if (status == 401) _onUnauthorized?.call();
      }
    } catch (_) {
      // Ignore uncorrelated or malformed frames.
    }
  }

  void _flush(WebSocketChannel channel) {
    for (final request in _pending.values) {
      if (request.sent) continue;
      try {
        channel.sink.add(request.frame);
        request.sent = true;
      } catch (_) {
        _disconnect(channel);
        return;
      }
    }
  }

  void _disconnect(WebSocketChannel channel) {
    if (_channel != channel) return;
    _detach();
    for (final entry in _pending.entries.toList()) {
      if (entry.value.sent) {
        _pending.remove(entry.key)?.fail("WebSocket connection interrupted");
      }
    }
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_token == null || _reconnect != null) return;
    _reconnect = Timer(
      Duration(milliseconds: _retryDelay + Random().nextInt(200)),
      () {
        _reconnect = null;
        unawaited(_connect());
      },
    );
    _retryDelay = min(_retryDelay * 2, 10000);
  }

  void _detach() {
    final channel = _channel;
    final subscription = _subscription;
    _channel = null;
    _subscription = null;
    _ready = false;
    if (subscription != null) {
      unawaited(subscription.cancel().catchError((Object _) {}));
    }
    if (channel != null) {
      unawaited(
        channel.sink.close().then<void>((_) {}, onError: (Object _) {}),
      );
    }
  }
}

class _Request {
  _Request(this.frame, this.result, this.timer);

  final String frame;
  final Completer<Object?> result;
  final Timer timer;
  bool sent = false;

  void complete(Object? response) {
    timer.cancel();
    result.complete(response);
  }

  void fail(String message) {
    timer.cancel();
    result.completeError(StateError(message));
  }
}
