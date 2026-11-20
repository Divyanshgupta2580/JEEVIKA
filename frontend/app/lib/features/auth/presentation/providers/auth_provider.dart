import "dart:async";

import "../../../../core/network/data_socket.dart";
import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "../../data/models/auth_models.dart";
import "../../data/repositories/auth_repository.dart";

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository();
});

@immutable
class AuthState {
  final bool isLoading;
  final AuthSession? session;
  final String? errorMessage;

  const AuthState({this.isLoading = false, this.session, this.errorMessage});

  bool get isAuthenticated {
    final current = session;
    return current != null &&
        current.token.isNotEmpty &&
        (current.expiresAt == null ||
            current.expiresAt!.isAfter(DateTime.now()));
  }

  AuthState copyWith({
    bool? isLoading,
    AuthSession? session,
    String? errorMessage,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      session: session ?? this.session,
      errorMessage: errorMessage,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository repository;
  Timer? _expiry;

  late final Future<void> ready = _restore();

  AuthNotifier(this.repository) : super(const AuthState(isLoading: true)) {
    unawaited(ready);
  }

  Future<void> _restore() async {
    final restored = await repository.restoreSession();
    if (mounted) _setSession(restored);
  }

  void _setSession(AuthSession? session) {
    DataSocket.instance.setSession(
      session?.token,
      onUnauthorized: () {
        if (mounted && state.session?.token == session?.token) {
          unawaited(logout());
        }
      },
    );
    _expiry?.cancel();
    state = AuthState(session: session);
    final expiry = session?.expiresAt;
    if (expiry != null) {
      _expiry = Timer(
        expiry.difference(DateTime.now()),
        () => unawaited(logout()),
      );
    }
  }

  Future<bool> login(String identifier, String password) async {
    await ready;
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final session = await repository.login(
        identifier: identifier,
        password: password,
      );
      _setSession(session);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst("Exception: ", ""),
      );
      return false;
    }
  }

  Future<bool> signup({
    required String name,
    required String phone,
    required String password,
    required String dob,
    required String sex,
    String? email,
    String? abhaNumber,
    String preferredLang = "hi",
  }) async {
    await ready;
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final session = await repository.signup(
        name: name,
        phone: phone,
        password: password,
        dob: dob,
        sex: sex,
        email: email,
        abhaNumber: abhaNumber,
        preferredLang: preferredLang,
      );
      _setSession(session);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst("Exception: ", ""),
      );
      return false;
    }
  }

  Future<void> markOnboardingComplete() async {
    if (state.session != null) {
      final updated = state.session!.copyWith(onboardingComplete: true);
      await repository.saveSession(updated);
      state = state.copyWith(session: updated);
    }
  }

  Future<void> logout() async {
    await ready;
    final token = state.session?.token;
    _setSession(null);
    if (token != null) await repository.logout(token);
  }

  @override
  void dispose() {
    _expiry?.cancel();
    DataSocket.instance.setSession(null);
    super.dispose();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthNotifier(repo);
});
