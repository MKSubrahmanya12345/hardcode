void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("SMOKE_OK");
}

void loop() {
  delay(500);
  Serial.println("SMOKE_ALIVE");
}
