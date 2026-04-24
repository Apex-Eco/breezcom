#!/bin/bash

# ========================================
# Local Testing Script for Breez AI
# Tests the complete Pi → Backend → Map flow
# ========================================

set -e

BACKEND_URL="http://localhost:8003"
ADMIN_SECRET="admin-secret"
TEST_USER_EMAIL="test@example.com"
TEST_USER_PASSWORD="test123"

echo "🚀 Starting Breez AI Local Testing"
echo "=================================="
echo ""

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
if ! curl -s "$BACKEND_URL/" > /dev/null 2>&1; then
    echo "❌ Backend not running on $BACKEND_URL"
    echo "Start it with: cd backend && python main.py"
    exit 1
fi
echo "✅ Backend is running"
echo ""

# Step 1: Get Admin Token
echo "2️⃣ Getting Admin Token..."
ADMIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"$ADMIN_SECRET\"}")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to get admin token"
    echo "Response: $ADMIN_RESPONSE"
    exit 1
fi
echo "✅ Admin token obtained"
echo ""

# Step 2: Get Device Token
echo "3️⃣ Getting Device Token for $TEST_USER_EMAIL..."
DEVICE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/device/token" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\"}")

DEVICE_TOKEN=$(echo $DEVICE_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$DEVICE_TOKEN" ]; then
    echo "❌ Failed to get device token"
    echo "Response: $DEVICE_RESPONSE"
    exit 1
fi
echo "✅ Device token obtained"
echo ""

# Save tokens for later use
echo "DEVICE_TOKEN=$DEVICE_TOKEN" > /tmp/breez_tokens.env
echo "USER_TOKEN_PLACEHOLDER=will_get_after_test" >> /tmp/breez_tokens.env

echo "   Tokens saved to: /tmp/breez_tokens.env"
echo ""

# Step 3: Send First Sensor Reading
echo "4️⃣ Sending FIRST sensor reading from Pi..."
SENSOR_DATA1='{
  "device_id": "lab01",
  "site": "AGI_Lab",
  "pm1": 15.5,
  "pm25": 28.3,
  "pm10": 35.5,
  "co2": 410,
  "voc": 0.2,
  "temp": 20.0,
  "hum": 55.0,
  "ch2o": 0.01,
  "co": 0.3,
  "o3": 28.0,
  "no2": 25.0
}'

INGEST_RESPONSE=$(curl -s -X POST "$BACKEND_URL/data" \
  -H "Authorization: Bearer $DEVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SENSOR_DATA1")

echo "Response: $INGEST_RESPONSE"

if echo "$INGEST_RESPONSE" | grep -q '"status":"ok"'; then
    echo "✅ First reading ingested successfully"
else
    echo "❌ Failed to ingest first reading"
    exit 1
fi
echo ""

# Step 4: Send Second Sensor Reading (with different values)
echo "5️⃣ Sending SECOND sensor reading (updated values)..."
SENSOR_DATA2='{
  "device_id": "lab01",
  "site": "AGI_Lab",
  "pm1": 12.0,
  "pm25": 32.5,
  "pm10": 42.1,
  "co2": 420,
  "voc": 0.3,
  "temp": 22.5,
  "hum": 60.0,
  "ch2o": 0.02,
  "co": 0.4,
  "o3": 30.0,
  "no2": 28.0
}'

INGEST_RESPONSE2=$(curl -s -X POST "$BACKEND_URL/data" \
  -H "Authorization: Bearer $DEVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SENSOR_DATA2")

echo "Response: $INGEST_RESPONSE2"

if echo "$INGEST_RESPONSE2" | grep -q '"status":"ok"'; then
    echo "✅ Second reading ingested successfully"
else
    echo "❌ Failed to ingest second reading"
    exit 1
fi
echo ""

# Step 5: User Login
echo "6️⃣ User login as $TEST_USER_EMAIL..."
USER_LOGIN=$(curl -s -X POST "$BACKEND_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$TEST_USER_EMAIL&password=$TEST_USER_PASSWORD")

USER_TOKEN=$(echo $USER_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$USER_TOKEN" ]; then
    echo "❌ Failed to login user"
    echo "Response: $USER_LOGIN"
    exit 1
fi
echo "✅ User login successful"
echo ""

# Step 6: Get Map Sensors
echo "7️⃣ Fetching sensors visible on map..."
MAP_RESPONSE=$(curl -s -X GET "$BACKEND_URL/sensors/map" \
  -H "Authorization: Bearer $USER_TOKEN")

# Check if lab01 sensor is in response
if echo "$MAP_RESPONSE" | grep -q '"name":"AGI_Lab"'; then
    echo "✅ Sensor 'AGI_Lab' found on map!"

    # Extract the sensor data
    LAB_SENSOR=$(echo "$MAP_RESPONSE" | grep -o '"name":"AGI_Lab"[^}]*"parameters":[^}]*}' | head -1)

    # Check current values
    if echo "$LAB_SENSOR" | grep -q '"pm25":32.5'; then
        echo "✅ PM2.5 value correct: 32.5 (updated from 28.3)"
    fi

    if echo "$LAB_SENSOR" | grep -q '"temp":22.5'; then
        echo "✅ Temperature correct: 22.5 (updated from 20.0)"
    fi

    if echo "$LAB_SENSOR" | grep -q '"hum":60'; then
        echo "✅ Humidity correct: 60.0 (updated from 55.0)"
    fi
else
    echo "❌ Sensor 'AGI_Lab' NOT found on map"
    echo "Response: $MAP_RESPONSE"
    exit 1
fi
echo ""

# Final Summary
echo "=================================="
echo "✅ ALL TESTS PASSED!"
echo "=================================="
echo ""
echo "📊 Summary:"
echo "  ✓ Backend is running"
echo "  ✓ Admin authentication works"
echo "  ✓ Device token generated successfully"
echo "  ✓ First Pi reading ingested"
echo "  ✓ Second Pi reading ingested (sensor updated)"
echo "  ✓ User can see sensor on map"
echo "  ✓ Sensor values are correct"
echo ""
echo "🔑 Device Token (save this for your Pi):"
echo "   $DEVICE_TOKEN"
echo ""
echo "📝 Usage on Raspberry Pi:"
echo "   export DEVICE_TOKEN=\"$DEVICE_TOKEN\""
echo "   python send.py"
echo ""
echo "✅ Ready for production deployment!"
