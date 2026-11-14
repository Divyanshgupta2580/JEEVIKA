abstract final class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: "https://jeevika-api.workers.dev/api/v1",
  );
}
