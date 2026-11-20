import "dart:convert";
import "package:flutter/foundation.dart";
import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";
import "../../../../core/network/api_config.dart";
import "../models/auth_models.dart";

class AuthRepository {
  static const String _sessionKey = "jeevika_auth_session_v1";

  Future<AuthSession?> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = prefs.getString(_sessionKey);
      if (jsonStr != null && jsonStr.isNotEmpty) {
        final map = jsonDecode(jsonStr) as Map<String, dynamic>;
        final session = AuthSession.fromJson(map);
        return await _verifySession(session);
      }
    } catch (e) {
      debugPrint("Error restoring session: $e");
    }
    return null;
  }

  Future<AuthSession?> _verifySession(AuthSession session) async {
    if (session.token.isEmpty || session.patientId.isEmpty) return null;
    final response = await http
        .get(
          Uri.parse("${ApiConfig.baseUrl}/auth/patient/me"),
          headers: {"Authorization": "Bearer ${session.token}"},
        )
        .timeout(const Duration(seconds: 6));
    if (response.statusCode == 401 || response.statusCode == 403) {
      await clearSession();
      return null;
    }
    if (response.statusCode != 200) return null;

    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (result["success"] != true || result["patientId"] != session.patientId) {
      await clearSession();
      return null;
    }
    final expiry = DateTime.tryParse(result["expiresAt"]?.toString() ?? "");
    return session.copyWith(expiresAt: expiry);
  }

  Future<AuthSession> _saveVerifiedSession(AuthSession session) async {
    final verified = await _verifySession(session);
    if (verified == null) {
      throw Exception("The patient session could not be verified.");
    }
    await saveSession(verified);
    return verified;
  }

  Future<void> saveSession(AuthSession session) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
    } catch (e) {
      debugPrint("Error saving session: $e");
    }
  }

  Future<void> clearSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sessionKey);
    } catch (e) {
      debugPrint("Error clearing session: $e");
    }
  }

  Future<AuthSession> login({
    required String identifier,
    required String password,
  }) async {
    final uri = Uri.parse("${ApiConfig.baseUrl}/auth/patient/login");
    final response = await http
        .post(
          uri,
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({"identifier": identifier, "password": password}),
        )
        .timeout(const Duration(seconds: 10));

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200 && data["success"] == true) {
      final token = data["token"]?.toString() ?? "";
      final p = data["patient"] as Map<String, dynamic>? ?? {};
      final patientId = p["id"];
      if (token.isEmpty || patientId is! String || patientId.isEmpty) {
        throw Exception("The server did not issue a patient session.");
      }
      final isOnboarded = data["onboardingComplete"] == true;

      final session = AuthSession(
        token: token,
        expiresAt: DateTime.tryParse(data["expiresAt"]?.toString() ?? ""),
        patientId: patientId,
        patientName: p["name"]?.toString() ?? "Jeevika Patient",
        phone: p["phone"]?.toString() ?? identifier,
        email: p["email"]?.toString(),
        abhaNumber: p["abhaNumber"]?.toString(),
        onboardingComplete: isOnboarded,
      );

      return _saveVerifiedSession(session);
    } else {
      throw Exception(
        data["error"]?.toString() ?? "Login failed. Please check credentials.",
      );
    }
  }

  Future<AuthSession> signup({
    required String name,
    required String phone,
    required String password,
    required String dob,
    required String sex,
    String? email,
    String? abhaNumber,
    String preferredLang = "hi",
  }) async {
    final uri = Uri.parse("${ApiConfig.baseUrl}/auth/patient/signup");
    final payload = <String, dynamic>{
      "name": name,
      "phone": phone,
      "password": password,
      "dob": dob,
      "sex": sex,
      "preferredLang": preferredLang,
    };
    if (email != null && email.trim().isNotEmpty) {
      payload["email"] = email.trim();
    }
    if (abhaNumber != null && abhaNumber.trim().isNotEmpty) {
      payload["abhaNumber"] = abhaNumber.trim();
    }

    final response = await http
        .post(
          uri,
          headers: {"Content-Type": "application/json"},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 10));

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 201 && data["success"] == true) {
      final token = data["token"]?.toString() ?? "";
      final p = data["patient"] as Map<String, dynamic>? ?? {};
      final patientId = p["id"];
      if (token.isEmpty || patientId is! String || patientId.isEmpty) {
        throw Exception("The server did not issue a patient session.");
      }

      final session = AuthSession(
        token: token,
        expiresAt: DateTime.tryParse(data["expiresAt"]?.toString() ?? ""),
        patientId: patientId,
        patientName: p["name"]?.toString() ?? name,
        phone: p["phone"]?.toString() ?? phone,
        email: email,
        abhaNumber: abhaNumber,
        onboardingComplete: false,
      );

      return _saveVerifiedSession(session);
    } else {
      throw Exception(data["error"]?.toString() ?? "Registration failed.");
    }
  }

  Future<void> logout(String token) async {
    await clearSession();
    try {
      final uri = Uri.parse("${ApiConfig.baseUrl}/auth/patient/logout");
      await http
          .post(
            uri,
            headers: {
              "Authorization": "Bearer $token",
              "Content-Type": "application/json",
            },
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {}
  }
}
