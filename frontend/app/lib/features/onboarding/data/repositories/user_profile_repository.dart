import "dart:convert";
import "package:flutter/foundation.dart";
import "package:shared_preferences/shared_preferences.dart";
import "../../../../core/network/data_socket.dart";
import "../models/user_profile_model.dart";

class UserProfileRepository {
  static const String _profilePrefix = "jeevika_user_profile_";

  Future<UserProfile?> getLocalProfile(String patientId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString("$_profilePrefix$patientId");
      if (str != null && str.isNotEmpty) {
        return UserProfile.fromJson(jsonDecode(str) as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint("Error reading local profile: $e");
    }
    return null;
  }

  Future<void> saveLocalProfile(UserProfile profile) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        "$_profilePrefix${profile.patientId}",
        jsonEncode(profile.toJson()),
      );
      // Also save to generic current profile key
      await prefs.setString(
        "jeevika_active_profile_v1",
        jsonEncode(profile.toJson()),
      );
    } catch (e) {
      debugPrint("Error saving local profile: $e");
    }
  }

  Future<UserProfile> fetchAndSyncProfile({
    required String patientId,
    required String token,
  }) async {
    // Check local first
    final local = await getLocalProfile(patientId);

    try {
      final path = "/patient/$patientId";
      final responses = await Future.wait([
        DataSocket.instance.request(token, "GET", "$path/preferences"),
        DataSocket.instance.request(token, "GET", "$path/ayurveda"),
      ]);
      final preferences = responses[0] as Map<String, dynamic>;
      final ayurveda = responses[1] as Map<String, dynamic>;
      final prefData = preferences["preferences"] as Map<String, dynamic>?;
      final ayurData = ayurveda["ayurveda"] as Map<String, dynamic>?;

      if (local != null) {
        final updated = local.copyWith(
          primaryFocus:
              prefData?["primaryFocus"]?.toString() ?? local.primaryFocus,
          themeMode: prefData?["themeMode"]?.toString() ?? local.themeMode,
          language: prefData?["language"]?.toString() ?? local.language,
          primaryDosha:
              ayurData?["primaryDosha"]?.toString() ?? local.primaryDosha,
          secondaryDosha:
              ayurData?["secondaryDosha"]?.toString() ?? local.secondaryDosha,
          prakritiSummary:
              ayurData?["prakritiSummary"]?.toString() ?? local.prakritiSummary,
        );
        await saveLocalProfile(updated);
        return updated;
      }
    } catch (e) {
      debugPrint("Error fetching remote profile: $e");
    }

    return local ??
        UserProfile(
          patientId: patientId,
          name: "Jeevika Patient",
          phone: "+91 98765 43210",
          dob: "1994-06-15",
          onboardingComplete: false,
        );
  }

  Future<void> syncProfileToBackend(UserProfile profile, String token) async {
    await saveLocalProfile(profile);

    try {
      final socket = DataSocket.instance;
      final path = "/patient/${profile.patientId}";

      // Sync Profile
      final profilePayload = <String, dynamic>{
        "name": profile.name,
        "dob": profile.dob,
        "sex": profile.sex,
        "allergies": profile.allergies,
        "chronicConditions": profile.chronicConditions,
        "preferredLang": profile.language,
      };
      if (profile.bloodGroup != null && profile.bloodGroup!.isNotEmpty) {
        profilePayload["bloodGroup"] = profile.bloodGroup;
      }
      if (profile.address != null && profile.address!.isNotEmpty) {
        profilePayload["address"] = profile.address;
      }
      if (profile.emergencyContact != null &&
          profile.emergencyContact!.isNotEmpty) {
        profilePayload["emergencyContact"] = profile.emergencyContact;
      }

      await socket.request(token, "PUT", "$path/profile", body: profilePayload);

      await socket.request(
        token,
        "PUT",
        "$path/preferences",
        body: {
          "primaryFocus": profile.primaryFocus,
          "themeMode": profile.themeMode,
          "language": profile.language,
        },
      );

      await socket.request(
        token,
        "PUT",
        "$path/ayurveda",
        body: {
          "primaryDosha": profile.primaryDosha,
          "secondaryDosha": profile.secondaryDosha,
          "prakritiSummary": profile.prakritiSummary,
          "agniType": profile.agniType,
        },
      );
    } catch (e) {
      debugPrint("Sync to backend skipped or queued: $e");
    }
  }
}
