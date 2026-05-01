from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
import httpx
import os
import json
import re
import asyncio
from dotenv import load_dotenv
from services.ml_service import smog_model_service
from services.weather_service import get_current_weather, get_weather_forecast

load_dotenv()

app = FastAPI(title="Breez API", version="1.0.0")

# CORS - allow localhost on any port + production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://localhost:3006",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
        "http://127.0.0.1:3006",
        "http://89.218.178.215:3003",
        "http://89.218.178.215:3000",
        "http://89.218.178.215:3001",
        "https://breez.com.kz",
        "https://www.breez.com.kz",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB or in-memory fallback when MongoDB is unavailable
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "breez")
client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DATABASE_NAME]  # May be replaced with MemoryDb at startup

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
# Using bcrypt directly instead of passlib to avoid compatibility issues
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Admin mock user
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "admin-secret")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@local")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin")

# Breez API
BREEZ_API_KEY = os.getenv("BREEZ_API_KEY", "")
BREEZ_BASE_URL = "http://api.airvisual.com/v2"

TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL", "test@example.com")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD", "test123")

IQAIR_API_KEY = os.getenv("IQAIR_API_KEY", "")
IQAIR_BASE_URL = "http://api.airvisual.com/v2"

DEMO_DATA_ENABLED = os.getenv("ENABLE_DEMO_DATA", "0").strip().lower() in {"1", "true", "yes", "on"}

# Air Quality Sensor API
SENSOR_API_URL = os.getenv("SENSOR_API_URL", "http://89.218.178.215:3003/")

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"
    sensor_permissions: Optional[List[str]] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class SensorData(BaseModel):
    device_id: str
    site: str
    pm1: float
    pm25: float
    pm10: float
    co2: float
    voc: float
    temp: float
    hum: float
    ch2o: float
    co: float
    o3: float
    no2: float

class AirQualityData(BaseModel):
    city: str
    state: str
    country: str
    location: dict
    current: dict
    historical: Optional[List[dict]] = None
    sensor_data: Optional[dict] = None

class AirQualityRequest(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class MlPredictRequest(BaseModel):
    pm1: float = 0
    pm25: float = 0
    pm10: float = 0
    co2: float = 0
    voc: float = 0
    ch2o: float = 0
    co: float = 0
    o3: float = 0
    no2: float = 0
    temp: float = 0
    humidity: float = 0
    wind_speed: float = 0
    pressure: float = 0


class MlPredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    predicted_aqi: int
    danger_level: str
    main_pollutant: str
    recommendation: str
    model_used: str

# Admin / sensors / purchases
class SensorBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = 0
    location: Optional[dict] = None  # {"type": "Point", "coordinates": [lon, lat]}
    city: Optional[str] = None
    country: Optional[str] = None
    parameters: Optional[dict] = None  # e.g. {"pm25": 12, "pm10": 20}


class SensorResponse(SensorBase):
    id: str
    created_at: datetime


class GrantAccessRequest(BaseModel):
    email: EmailStr


class MakeAdminRequest(BaseModel):
    email: EmailStr

# Helper functions
def verify_password(plain_password, hashed_password):
    """Verify a password against a hash"""
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password, hashed_password)

def get_password_hash(password):
    """Hash a password using bcrypt"""
    if isinstance(password, str):
        password = password.encode('utf-8')
    # bcrypt has a 72 byte limit, truncate if necessary
    if len(password) > 72:
        password = password[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# In-memory fallback when MongoDB is unavailable
class MemoryCollection:
    """In-memory collection mimicking Motor's async interface."""
    def __init__(self, name: str, initial_data: list = None):
        self.name = name
        self._data = {}
        self._counter = 1
        for doc in (initial_data or []):
            doc = dict(doc)
            k = str(doc.get("_id", self._counter))
            self._data[k] = doc
            self._data[k]["_id"] = k
            self._counter += 1
        self._counter = max(self._counter, len(self._data) + 1)

    async def find_one(self, query: dict):
        if "_id" in query:
            key = str(query["_id"])
            return self._data.get(key)
        # Generic field match: iterate and check all query keys
        for doc in self._data.values():
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    async def insert_one(self, doc: dict):
        key = str(ObjectId())
        doc = dict(doc)
        doc["_id"] = key
        self._data[key] = doc
        class R:
            inserted_id = key
        return R()

    async def update_one(self, query: dict, update: dict):
        doc = await self.find_one(query)
        if not doc:
            class R:
                matched_count = 0
                modified_count = 0
            return R()
        key = str(doc["_id"])
        if "$set" in update:
            for k, v in update["$set"].items():
                self._data[key][k] = v
        if "$addToSet" in update:
            for k, v in update["$addToSet"].items():
                arr = self._data[key].setdefault(k, [])
                if isinstance(v, dict) and "$each" in v:
                    for x in v["$each"]:
                        if x not in arr:
                            arr.append(x)
                elif v not in arr:
                    arr.append(v)
        class R:
            matched_count = 1
            modified_count = 1
        return R()

    def find(self, query: dict = None):
        class Cursor:
            def __init__(self, items):
                self._items = list(items)
            def limit(self, n):
                self._items = self._items[:n] if n > 0 else self._items
                return self
            async def to_list(self, length):
                return self._items[:length] if length else self._items
        return Cursor(self._data.values())


class MemoryDb:
    """In-memory DB used when MongoDB is unavailable."""
    def __init__(self):
        # Use ObjectId-compatible ID so safe_get_user_id works
        oid = str(ObjectId())
        self.users = MemoryCollection("users", [{
            "_id": oid,
            "email": TEST_USER_EMAIL,
            "name": "Test User",
            "hashed_password": get_password_hash(TEST_USER_PASSWORD),
            "role": "user",
            "sensor_permissions": [],
        }])
        self.sensors = MemoryCollection("sensors", [])
        self.sensor_readings = MemoryCollection("sensor_readings", [])
        self.air_quality_history = MemoryCollection("air_quality_history", [])
        self.cities = MemoryCollection("cities", [])
        self.purchases = MemoryCollection("purchases", [])


def sensor_to_response(sensor: dict) -> dict:
    sid = sensor.get("_id")
    return {
        "id": str(sid) if sid is not None else None,
        "name": sensor.get("name"),
        "description": sensor.get("description"),
        "price": sensor.get("price", 0),
        "location": sensor.get("location"),
        "city": sensor.get("city"),
        "country": sensor.get("country"),
        "parameters": sensor.get("parameters", {}),
        "created_at": sensor.get("created_at"),
    }


DEMO_SENSORS = [
    {
        "name": "Downtown Center",
        "description": "Sensor in downtown business district",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9385, 43.2380]},
        "parameters": {"pm25": 45.5, "pm10": 65.2, "co2": 420, "co": 0.8, "o3": 35, "no2": 42, "voc": 0.5, "ch2o": 0.02, "temp": 22, "hum": 45},
    },
    {
        "name": "Gorky Park",
        "description": "Sensor near Gorky Park",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9420, 43.2180]},
        "parameters": {"pm25": 28.3, "pm10": 35.5, "co2": 410, "co": 0.3, "o3": 28, "no2": 25, "voc": 0.2, "ch2o": 0.01, "temp": 20, "hum": 55},
    },
    {
        "name": "Industrial Zone East",
        "description": "Sensor in eastern industrial area",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [77.0500, 43.1800]},
        "parameters": {"pm25": 95.7, "pm10": 145.2, "co2": 480, "co": 2.5, "o3": 55, "no2": 78, "voc": 1.2, "ch2o": 0.08, "temp": 24, "hum": 35},
    },
    {
        "name": "Al-Farabi Avenue",
        "description": "Sensor on Al-Farabi Avenue highway",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.8930, 43.2110]},
        "parameters": {"pm25": 65.4, "pm10": 95.8, "co2": 450, "co": 1.5, "o3": 45, "no2": 58, "voc": 0.8, "ch2o": 0.04, "temp": 21, "hum": 50},
    },
    {
        "name": "Samal District",
        "description": "Sensor in Samal residential district",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9570, 43.2320]},
        "parameters": {"pm25": 38.2, "pm10": 52.1, "co2": 415, "co": 0.5, "o3": 32, "no2": 35, "voc": 0.3, "ch2o": 0.015, "temp": 19, "hum": 60},
    },
    {
        "name": "Medeu",
        "description": "Sensor near Medeu skating rink in the mountains",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [77.0580, 43.1570]},
        "parameters": {"pm25": 12.1, "pm10": 18.4, "co2": 395, "co": 0.1, "o3": 42, "no2": 10, "voc": 0.1, "ch2o": 0.005, "temp": 14, "hum": 65},
    },
    {
        "name": "Shymbulak",
        "description": "Sensor near Shymbulak ski resort",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [77.0810, 43.1320]},
        "parameters": {"pm25": 8.5, "pm10": 12.0, "co2": 385, "co": 0.05, "o3": 48, "no2": 5, "voc": 0.05, "ch2o": 0.003, "temp": 8, "hum": 70},
    },
    {
        "name": "Mega Center Alma-Ata",
        "description": "Sensor near Mega Center shopping mall",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.8520, 43.2070]},
        "parameters": {"pm25": 52.3, "pm10": 74.6, "co2": 440, "co": 1.1, "o3": 38, "no2": 48, "voc": 0.6, "ch2o": 0.03, "temp": 23, "hum": 42},
    },
    {
        "name": "Green Bazaar",
        "description": "Sensor near Zelyony Bazaar market",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9450, 43.2560]},
        "parameters": {"pm25": 58.9, "pm10": 82.3, "co2": 445, "co": 1.3, "o3": 30, "no2": 52, "voc": 0.7, "ch2o": 0.035, "temp": 22, "hum": 48},
    },
    {
        "name": "Almaty-1 Station",
        "description": "Sensor near Almaty-1 railway station",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9120, 43.2880]},
        "parameters": {"pm25": 72.1, "pm10": 108.5, "co2": 460, "co": 1.8, "o3": 40, "no2": 65, "voc": 0.9, "ch2o": 0.05, "temp": 23, "hum": 40},
    },
    {
        "name": "Almaty-2 Station",
        "description": "Sensor near Almaty-2 railway station",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9460, 43.2400]},
        "parameters": {"pm25": 68.4, "pm10": 99.2, "co2": 455, "co": 1.6, "o3": 36, "no2": 60, "voc": 0.85, "ch2o": 0.045, "temp": 22, "hum": 43},
    },
    {
        "name": "Kok-Tobe",
        "description": "Sensor on Kok-Tobe hill viewpoint",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9840, 43.2270]},
        "parameters": {"pm25": 18.7, "pm10": 25.3, "co2": 400, "co": 0.2, "o3": 45, "no2": 15, "voc": 0.15, "ch2o": 0.008, "temp": 16, "hum": 58},
    },
    {
        "name": "Abay Avenue",
        "description": "Sensor on Abay Avenue major road",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9100, 43.2400]},
        "parameters": {"pm25": 62.0, "pm10": 88.5, "co2": 448, "co": 1.4, "o3": 33, "no2": 55, "voc": 0.75, "ch2o": 0.038, "temp": 22, "hum": 44},
    },
    {
        "name": "Raimbek Avenue",
        "description": "Sensor on Raimbek Avenue near bazaar",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9250, 43.2600]},
        "parameters": {"pm25": 70.5, "pm10": 102.0, "co2": 458, "co": 1.7, "o3": 35, "no2": 62, "voc": 0.88, "ch2o": 0.048, "temp": 23, "hum": 41},
    },
    {
        "name": "Botanical Garden",
        "description": "Sensor near the Main Botanical Garden",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9380, 43.2220]},
        "parameters": {"pm25": 22.5, "pm10": 30.0, "co2": 405, "co": 0.25, "o3": 38, "no2": 18, "voc": 0.18, "ch2o": 0.009, "temp": 19, "hum": 58},
    },
    {
        "name": "KBTU University",
        "description": "Sensor near Kazakh-British Technical University",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.9460, 43.2370]},
        "parameters": {"pm25": 40.0, "pm10": 56.0, "co2": 425, "co": 0.7, "o3": 30, "no2": 38, "voc": 0.4, "ch2o": 0.02, "temp": 21, "hum": 50},
    },
    {
        "name": "Airport",
        "description": "Sensor near Almaty International Airport",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [77.0400, 43.3530]},
        "parameters": {"pm25": 55.8, "pm10": 78.4, "co2": 442, "co": 1.2, "o3": 32, "no2": 50, "voc": 0.65, "ch2o": 0.032, "temp": 22, "hum": 46},
    },
    {
        "name": "Tastak District",
        "description": "Sensor in Tastak residential area",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.8770, 43.2560]},
        "parameters": {"pm25": 42.0, "pm10": 60.0, "co2": 422, "co": 0.6, "o3": 34, "no2": 40, "voc": 0.45, "ch2o": 0.022, "temp": 20, "hum": 52},
    },
    {
        "name": "Orbita District",
        "description": "Sensor in Orbita microdistrict",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.8650, 43.2150]},
        "parameters": {"pm25": 35.0, "pm10": 48.5, "co2": 412, "co": 0.45, "o3": 36, "no2": 30, "voc": 0.28, "ch2o": 0.014, "temp": 19, "hum": 56},
    },
    {
        "name": "Aksay District",
        "description": "Sensor in Aksay residential area",
        "city": "Almaty",
        "country": "Kazakhstan",
        "location": {"type": "Point", "coordinates": [76.8400, 43.2370]},
        "parameters": {"pm25": 48.0, "pm10": 68.0, "co2": 430, "co": 0.9, "o3": 31, "no2": 44, "voc": 0.55, "ch2o": 0.028, "temp": 21, "hum": 47},
    },
]

DEMO_SENSOR_NAMES = {sensor["name"] for sensor in DEMO_SENSORS}


def is_demo_sensor_document(sensor: dict) -> bool:
    return not DEMO_DATA_ENABLED and isinstance(sensor, dict) and sensor.get("name") in DEMO_SENSOR_NAMES


def filter_demo_sensor_documents(sensors):
    if DEMO_DATA_ENABLED:
        return sensors
    return [sensor for sensor in sensors if not is_demo_sensor_document(sensor)]


async def get_seeded_sensor_ids():
    """Get IDs of all seeded demo sensors by their names."""
    if not DEMO_DATA_ENABLED:
        return []
    sensor_ids = []
    for sensor_def in DEMO_SENSORS:
        sensor = await db.sensors.find_one({"name": sensor_def["name"]})
        if sensor:
            sensor_ids.append(str(sensor["_id"]))
    return sensor_ids


async def ensure_demo_sensors_exist():
    """Ensure all demo sensors exist and return their IDs."""
    if not DEMO_DATA_ENABLED:
        return []
    for sensor_doc in DEMO_SENSORS:
        existing = await db.sensors.find_one({"name": sensor_doc["name"]})
        if existing:
            print(f"  ⊝ Sensor exists: {sensor_doc['name']}")
        else:
            doc = {**sensor_doc, "created_at": datetime.utcnow()}
            await db.sensors.insert_one(doc)
            print(f"  ✓ Added sensor {sensor_doc['name']}")

    return await get_seeded_sensor_ids()


async def ensure_user_has_seeded_sensors(user: dict):
    """Ensure a specific user has access to all seeded sensors."""
    if not DEMO_DATA_ENABLED:
        return []
    sensor_ids = await get_seeded_sensor_ids()
    if not sensor_ids:
        return []

    current_permissions = set(user.get("sensor_permissions", []) or [])
    missing_ids = [sid for sid in sensor_ids if sid not in current_permissions]

    if missing_ids:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$addToSet": {"sensor_permissions": {"$each": missing_ids}}}
        )
        print(f"✓ Backfilled {len(missing_ids)} sensors for user {user.get('email')}")

    return sensor_ids


async def grant_sensors_to_all_users(sensor_ids):
    """Grant the given sensor IDs to every user in the database."""
    if not DEMO_DATA_ENABLED:
        return
    if not sensor_ids:
        return

    users = await db.users.find({}).to_list(5000)
    updated_users = 0
    for user in users:
        current_permissions = set(user.get("sensor_permissions", []) or [])
        missing_ids = [sid for sid in sensor_ids if sid not in current_permissions]
        if not missing_ids:
            continue
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$addToSet": {"sensor_permissions": {"$each": missing_ids}}}
        )
        updated_users += 1

    print(f"✓ Granted {len(sensor_ids)} sensors to {updated_users} existing users")


async def remove_demo_sensors_and_permissions():
    """Remove legacy demo sensors and permissions when demo data is disabled."""
    if DEMO_DATA_ENABLED or db.__class__.__name__ == "MemoryDb":
        return

    try:
        demo_sensors = await db.sensors.find({"name": {"$in": list(DEMO_SENSOR_NAMES)}}).to_list(500)
        demo_sensor_ids = [str(sensor.get("_id")) for sensor in demo_sensors if sensor.get("_id")]

        if demo_sensor_ids:
            await db.users.update_many(
                {},
                {"$pull": {"sensor_permissions": {"$in": demo_sensor_ids}}},
            )
            await db.sensors.delete_many({"name": {"$in": list(DEMO_SENSOR_NAMES)}})
            print(f"✓ Removed {len(demo_sensor_ids)} demo sensors from database")
    except Exception as e:
        print(f"Demo cleanup failed: {e}")


async def seed_test_user_and_sensors():
    """Ensure demo user and 20 sensors exist in Mongo, granted to ALL users."""
    if not DEMO_DATA_ENABLED:
        print("ℹ️  Demo sensor seeding is disabled.")
        return
    try:
        user = await db.users.find_one({"email": TEST_USER_EMAIL})
        if not user:
            user_doc = {
                "email": TEST_USER_EMAIL,
                "name": "Test User",
                "hashed_password": get_password_hash(TEST_USER_PASSWORD),
                "created_at": datetime.utcnow(),
                "role": "user",
                "sensor_permissions": [],
            }
            await db.users.insert_one(user_doc)
            print(f"✓ Created demo user {TEST_USER_EMAIL}")
        else:
            print(f"✓ Demo user exists: {TEST_USER_EMAIL}")

        sensor_ids = await ensure_demo_sensors_exist()
        print(f"✓ Total seeded sensors: {len(sensor_ids)}")
        await grant_sensors_to_all_users(sensor_ids)
    except Exception as e:
        print(f"Demo seed failed: {e}")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role", "user")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Mock admin user (не хранится в БД)
    if email == ADMIN_EMAIL and role == "admin":
        return {
            "_id": "admin",
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "role": "admin",
            "sensor_permissions": []
        }
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    # гарантируем роль и права
    user["role"] = user.get("role", role or "user")
    user["sensor_permissions"] = user.get("sensor_permissions", [])
    return user


def user_is_admin(user: dict) -> bool:
    return user.get("role") == "admin"


def safe_get_user_id(current_user: dict):
    """
    Безопасно получает user_id из current_user, обрабатывая случай мок-админа.
    Возвращает tuple: (is_admin: bool, user_id: ObjectId | None)
    """
    user_id = current_user.get("_id")
    
    # Проверяем на мок-админа
    if user_id == "admin" or str(user_id).lower() == "admin":
        return (True, None)
    
    # Конвертируем в ObjectId если нужно
    if isinstance(user_id, ObjectId):
        return (False, user_id)
    elif isinstance(user_id, str) and ObjectId.is_valid(user_id):
        return (False, ObjectId(user_id))
    else:
        # Некорректный user_id
        print(f"⚠️ Invalid user_id in safe_get_user_id: {user_id}, type: {type(user_id)}")
        return (False, None)


async def require_admin(current_user: dict = Depends(get_current_user)):
    if not user_is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@app.on_event("startup")
async def on_startup():
    global db
    try:
        await asyncio.wait_for(client.admin.command("ping"), timeout=3.0)
        db = client[DATABASE_NAME]
        print("✓ Connected to MongoDB")
    except Exception as e:
        print(f"⚠️ MongoDB unavailable ({e}), using in-memory store")
        db = MemoryDb()
    await remove_demo_sensors_and_permissions()
    await seed_test_user_and_sensors()

# Routes
@app.get("/")
async def root():
    return {"message": "Breez API", "version": "1.0.0"}


@app.post("/ml/predict", response_model=MlPredictResponse)
async def predict_smog(body: MlPredictRequest):
    return smog_model_service.predict(body.dict())


@app.get("/weather/current")
async def weather_current(lat: float, lon: float):
    try:
        return await get_current_weather(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather unavailable: {str(e)}")


@app.get("/weather/forecast")
async def weather_forecast(lat: float, lon: float):
    try:
        return await get_weather_forecast(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather forecast unavailable: {str(e)}")

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        print(f"🔐 Hashing password for user: {user.email}")
        hashed_password = get_password_hash(user.password)
        print(f"✓ Password hashed successfully")

        sensor_ids = await get_seeded_sensor_ids() if DEMO_DATA_ENABLED else []

        user_dict = {
            "email": user.email,
            "name": user.name,
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow(),
            "role": "user",
            "sensor_permissions": sensor_ids,
        }
        print(f"💾 Inserting user into database...")
        result = await db.users.insert_one(user_dict)
        print(f"✓ User created with ID: {result.inserted_id} with {len(sensor_ids)} sensors")
        user_dict["id"] = str(result.inserted_id)
        return UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            name=user_dict["name"],
            role=user_dict["role"],
            sensor_permissions=user_dict["sensor_permissions"]
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Backfill seeded sensors for older users only when demo mode is enabled
    await ensure_user_has_seeded_sensors(user)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    user_role = user.get("role", "user")
    access_token = create_access_token(
        data={"sub": user["email"], "role": user_role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        name=current_user["name"],
        role=current_user.get("role", "user"),
        sensor_permissions=current_user.get("sensor_permissions", [])
    )


class AdminLoginRequest(BaseModel):
    secret: str


@app.post("/admin/login", response_model=Token)
async def admin_login(body: AdminLoginRequest):
    if body.secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin secret")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": ADMIN_EMAIL, "role": "admin"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

def calculate_aqi(pm25: float) -> int:
    """Вычисляет AQI на основе PM2.5 по стандарту US EPA"""
    if pm25 <= 12.0:
        return int((50 / 12.0) * pm25)
    elif pm25 <= 35.4:
        return int(50 + ((100 - 50) / (35.4 - 12.0)) * (pm25 - 12.0))
    elif pm25 <= 55.4:
        return int(100 + ((150 - 100) / (55.4 - 35.4)) * (pm25 - 35.4))
    elif pm25 <= 150.4:
        return int(150 + ((200 - 150) / (150.4 - 55.4)) * (pm25 - 55.4))
    elif pm25 <= 250.4:
        return int(200 + ((300 - 200) / (250.4 - 150.4)) * (pm25 - 150.4))
    else:
        return int(300 + ((400 - 300) / (350.4 - 250.4)) * (pm25 - 250.4))

@app.get("/air-quality", response_model=AirQualityData)
async def get_air_quality(
    city: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Используем тестовые данные (API отключено)
        sensor_data = None
        
        # Если есть данные с сенсора, используем их (но сейчас отключено)
        if False and sensor_data:
            try:
                pm25 = float(sensor_data.get("pm25", 0) or 0)
                if pm25 <= 0:
                    pm25 = 25.7  # Default fallback
                aqius = calculate_aqi(pm25)
            except (ValueError, TypeError) as e:
                print(f"Error processing sensor data: {e}")
                sensor_data = None
            
            if sensor_data:
                return {
                    "city": city or "Almaty",
                    "state": state or "Almaty",
                    "country": country or "Kazakhstan",
                    "location": {
                        "type": "Point",
                        "coordinates": [float(lon or 76.8512), float(lat or 43.2220)]
                    },
                    "current": {
                        "pollution": {
                            "ts": datetime.utcnow().isoformat(),
                            "aqius": aqius,
                            "mainus": "pm25",
                            "aqicn": aqius,
                            "maincn": "pm25",
                            "pm1": float(sensor_data.get("pm1", 0) or 0),
                            "pm25": float(sensor_data.get("pm25", 0) or 0),
                            "pm10": float(sensor_data.get("pm10", 0) or 0),
                            "co2": float(sensor_data.get("co2", 0) or 0),
                            "voc": float(sensor_data.get("voc", 0) or 0),
                            "ch2o": float(sensor_data.get("ch2o", 0) or 0),
                            "co": float(sensor_data.get("co", 0) or 0),
                            "o3": float(sensor_data.get("o3", 0) or 0),
                            "no2": float(sensor_data.get("no2", 0) or 0),
                        },
                        "weather": {
                            "ts": datetime.utcnow().isoformat(),
                            "tp": float(sensor_data.get("temp", 0) or 0),
                            "pr": 1013,
                            "hu": float(sensor_data.get("hum", 0) or 0),
                            "ws": 0,
                            "wd": 0,
                            "ic": "01d"
                        }
                    },
                    "sensor_data": {
                        "device_id": sensor_data.get("device_id", ""),
                        "site": sensor_data.get("site", ""),
                    }
                }
        
        # Fallback на mock данные
        return {
            "city": city or "Almaty",
            "state": state or "Almaty",
            "country": country or "Kazakhstan",
            "location": {
                "type": "Point",
                "coordinates": [float(lon or 76.8512), float(lat or 43.2220)]
            },
            "current": {
                "pollution": {
                    "ts": datetime.utcnow().isoformat(),
                    "aqius": 45,
                    "mainus": "p2",
                    "aqicn": 30,
                    "maincn": "p2"
                },
                "weather": {
                    "ts": datetime.utcnow().isoformat(),
                    "tp": 15,
                    "pr": 1013,
                    "hu": 65,
                    "ws": 5.2,
                    "wd": 180,
                    "ic": "01d"
                }
            }
        }
    except Exception as e:
        print(f"Error in get_air_quality: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/air-quality/history")
async def get_air_quality_history(
    city: str,
    state: str,
    country: str,
    current_user: dict = Depends(get_current_user)
):
    # Get historical data from MongoDB
    history = await db.air_quality_history.find({
        "city": city,
        "state": state,
        "country": country
    }).sort("timestamp", -1).limit(30).to_list(30)
    
    return {"history": history}

@app.get("/air-quality/all")
async def get_all_air_quality_data(current_user: dict = Depends(get_current_user)):
    """Получить данные со всех доступных сенсоров"""
    try:
        sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(1000))
        all_data = []
        print(f"Loading air-quality data from {len(sensors)} sensors")

        for sensor in sensors:
            try:
                coords = (sensor.get("location") or {}).get("coordinates") or []
                if len(coords) != 2:
                    continue

                lon, lat = coords
                params = sensor.get("parameters") or {}
                pm25 = float(params.get("pm25", 0) or 0)
                aqius = calculate_aqi(pm25)

                all_data.append({
                    "city": sensor.get("city") or "Almaty",
                    "state": sensor.get("city") or "Almaty",
                    "country": sensor.get("country") or "Kazakhstan",
                    "location": {
                        "type": "Point",
                        "coordinates": [float(lon), float(lat)],
                    },
                    "current": {
                        "pollution": {
                            "ts": datetime.utcnow().isoformat(),
                            "aqius": aqius,
                            "mainus": "pm25",
                            "aqicn": aqius,
                            "maincn": "pm25",
                            "pm1": float(params.get("pm1", 0) or 0),
                            "pm25": pm25,
                            "pm10": float(params.get("pm10", 0) or 0),
                            "co2": float(params.get("co2", 0) or 0),
                            "voc": float(params.get("voc", 0) or 0),
                            "ch2o": float(params.get("ch2o", 0) or 0),
                            "co": float(params.get("co", 0) or 0),
                            "o3": float(params.get("o3", 0) or 0),
                            "no2": float(params.get("no2", 0) or 0),
                        },
                        "weather": {
                            "ts": datetime.utcnow().isoformat(),
                            "tp": float(params.get("temp", 0) or 0),
                            "pr": 1013,
                            "hu": float(params.get("hum", 0) or 0),
                            "ws": 0,
                            "wd": 0,
                            "ic": "01d",
                        },
                    },
                    "sensor_data": {
                        "device_id": sensor.get("device_id", "") or str(sensor.get("_id", "")),
                        "site": sensor.get("site", "") or sensor.get("name", ""),
                        "danger_level": sensor.get("danger_level", "safe"),
                    },
                })
            except Exception as e:
                print(f"Error processing sensor {sensor.get('device_id', sensor.get('name', 'unknown'))}: {e}")

        print(f"=== FINAL RESULT: Returning {len(all_data)} data points ===")
        return {"data": all_data}
    except Exception as e:
        print(f"Error in get_all_air_quality_data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/cities")
async def get_supported_cities(current_user: dict = Depends(get_current_user)):
    # Get list of cities from MongoDB or return popular cities
    cities = await db.cities.find({}).to_list(100)
    if not cities:
        # Default cities - только Алматы
        default_cities = [
            {"city": "Almaty", "state": "Almaty", "country": "Kazakhstan", "lat": 43.2220, "lon": 76.8512},
        ]
        return {"cities": default_cities}
    
    # Фильтруем только Алматы
    almaty_cities = [c for c in cities if c.get("city", "").lower() == "almaty" and c.get("country", "").lower() == "kazakhstan"]
    if not almaty_cities:
        default_cities = [
            {"city": "Almaty", "state": "Almaty", "country": "Kazakhstan", "lat": 43.2220, "lon": 76.8512},
        ]
        return {"cities": default_cities}
    
    return {"cities": almaty_cities}

@app.post("/air-quality/save")
async def save_air_quality_data(
    data: AirQualityData,
    current_user: dict = Depends(get_current_user)
):
    # Save air quality data to MongoDB
    data_dict = data.dict()
    data_dict["user_id"] = str(current_user["_id"])
    data_dict["timestamp"] = datetime.utcnow()
    
    result = await db.air_quality_history.insert_one(data_dict)
    return {"id": str(result.inserted_id), "message": "Data saved successfully"}


# -------------------------
# Admin & paid sensors flow
# -------------------------
@app.post("/admin/sensors", response_model=SensorResponse)
async def create_sensor(sensor: SensorBase, current_user: dict = Depends(require_admin)):
    sensor_doc = sensor.dict()
    sensor_doc["created_at"] = datetime.utcnow()
    result = await db.sensors.insert_one(sensor_doc)
    sensor_doc["_id"] = result.inserted_id
    return sensor_to_response(sensor_doc)


@app.get("/admin/sensors")
async def list_sensors(current_user: dict = Depends(require_admin)):
    sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(500))
    return {"data": [sensor_to_response(s) for s in sensors]}


@app.get("/admin/users")
async def list_users(current_user: dict = Depends(require_admin)):
    users = await db.users.find({}).to_list(500)
    return {
        "data": [
            {
                "id": str(u.get("_id")),
                "email": u.get("email"),
                "name": u.get("name"),
                "role": u.get("role", "user"),
                "sensor_permissions": u.get("sensor_permissions", []),
            }
            for u in users
        ]
    }


@app.post("/admin/users/make-admin")
async def make_admin(request: MakeAdminRequest, current_user: dict = Depends(require_admin)):
    result = await db.users.update_one(
        {"email": request.email},
        {"$set": {"role": "admin"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User {request.email} is now admin"}


@app.post("/admin/sensors/{sensor_id}/grant")
async def grant_sensor_access(sensor_id: str, request: GrantAccessRequest, current_user: dict = Depends(require_admin)):
    if not ObjectId.is_valid(sensor_id):
        raise HTTPException(status_code=400, detail="Invalid sensor id")
    sensor = await db.sensors.find_one({"_id": ObjectId(sensor_id)})
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    if is_demo_sensor_document(sensor):
        raise HTTPException(status_code=404, detail="Demo sensor access is disabled")
    user = await db.users.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$addToSet": {"sensor_permissions": str(sensor["_id"])}}
    )
    return {"message": f"Access to sensor {sensor_id} granted for {request.email}"}


@app.get("/me/sensors")
async def get_my_sensors(current_user: dict = Depends(get_current_user)):
    try:
        # Проверяем, является ли пользователь мок-админом
        if current_user.get("_id") == "admin":
            # Для мок-админа возвращаем пустой список (админы не покупают датчики)
            return {"data": []}
        
        # Обновляем данные пользователя из базы, чтобы получить актуальные sensor_permissions
        user_id = current_user.get("_id")
        if isinstance(user_id, str) and ObjectId.is_valid(user_id):
            user_id = ObjectId(user_id)
        elif not isinstance(user_id, ObjectId):
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        sensor_ids = user.get("sensor_permissions", []) or []
        object_ids = [ObjectId(sid) for sid in sensor_ids if ObjectId.is_valid(sid)]
        if not object_ids:
            return {"data": []}
        sensors = filter_demo_sensor_documents(await db.sensors.find({"_id": {"$in": object_ids}}).to_list(500))
        return {"data": [sensor_to_response(s) for s in sensors]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_sensors: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/sensors/available")
async def get_available_sensors(current_user: dict = Depends(get_current_user)):
    """
    Возвращает все датчики, доступные для покупки (исключая уже купленные пользователем).
    """
    try:
        # Проверяем, является ли пользователь мок-админом
        if current_user.get("_id") == "admin":
            # Для мок-админа возвращаем все датчики как доступные
            all_sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(500))
            return {"data": [sensor_to_response(s) for s in all_sensors]}
        
        # Обновляем данные пользователя из базы, чтобы получить актуальные sensor_permissions
        user_id = current_user.get("_id")
        if isinstance(user_id, str) and ObjectId.is_valid(user_id):
            user_id = ObjectId(user_id)
        elif not isinstance(user_id, ObjectId):
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_sensor_ids = set(user.get("sensor_permissions", []) or [])
        all_sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(500))
        
        print(f"🔍 Available sensors check:")
        print(f"  - Total sensors in DB: {len(all_sensors)}")
        print(f"  - User sensor permissions: {user_sensor_ids}")
        
        available = []
        for sensor in all_sensors:
            sensor_id_str = str(sensor.get("_id"))
            if sensor_id_str not in user_sensor_ids:
                available.append(sensor_to_response(sensor))
        
        print(f"  - Available sensors: {len(available)}")
        return {"data": available}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_available_sensors: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/sensors/all")
async def get_all_sensors_with_status(current_user: dict = Depends(get_current_user)):
    """
    Возвращает все датчики с флагом is_purchased для текущего пользователя.
    """
    try:
        is_admin, user_id = safe_get_user_id(current_user)
        
        # Если мок-админ, возвращаем все датчики как некупленные
        if is_admin:
            print("🔍 Detected mock admin user")
            all_sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(500))
            result = []
            for sensor in all_sensors:
                sensor_response = sensor_to_response(sensor)
                sensor_response["is_purchased"] = False
                result.append(sensor_response)
            return {"data": result}
        
        # Если user_id некорректный, возвращаем пустой список
        if user_id is None:
            print("⚠️ Invalid user_id, returning empty list")
            return {"data": []}
        
        # Получаем актуальные данные пользователя из базы
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_sensor_ids = set(user.get("sensor_permissions", []) or [])
        all_sensors = filter_demo_sensor_documents(await db.sensors.find({}).to_list(500))
        
        print(f"🔍 All sensors check:")
        print(f"  - Total sensors in DB: {len(all_sensors)}")
        print(f"  - User sensor permissions: {user_sensor_ids}")
        
        result = []
        for sensor in all_sensors:
            sensor_id_str = str(sensor.get("_id"))
            sensor_response = sensor_to_response(sensor)
            sensor_response["is_purchased"] = sensor_id_str in user_sensor_ids
            result.append(sensor_response)
        
        print(f"  - Purchased sensors: {sum(1 for s in result if s.get('is_purchased'))}")
        return {"data": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_all_sensors_with_status: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")




@app.get("/sensors/map")
async def get_map_sensors(current_user: dict = Depends(get_current_user)):
    """
    Возвращает только те датчики, на которые у пользователя есть права (куплено или выдано админом).
    """
    try:
        # Проверяем, является ли пользователь мок-админом
        if current_user.get("_id") == "admin":
            # Для мок-админа возвращаем пустой список (админы не видят датчики на карте)
            return {"data": []}
        
        # Обновляем данные пользователя из базы, чтобы получить актуальные sensor_permissions
        user_id = current_user.get("_id")
        if isinstance(user_id, str) and ObjectId.is_valid(user_id):
            user_id = ObjectId(user_id)
        elif not isinstance(user_id, ObjectId):
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        user = await db.users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        sensor_ids = user.get("sensor_permissions", []) or []
        object_ids = [ObjectId(sid) for sid in sensor_ids if ObjectId.is_valid(sid)]
        if not object_ids:
            return {"data": []}
    
        sensors = filter_demo_sensor_documents(await db.sensors.find({"_id": {"$in": object_ids}}).to_list(500))
        
        print(f"🔍 Map sensors check:")
        print(f"  - User sensor permissions: {sensor_ids}")
        print(f"  - Converted ObjectIds: {len(object_ids)}")
        print(f"  - Found sensors in DB: {len(sensors)}")
        
        map_points = []
        for sensor in sensors:
            coords = (sensor.get("location") or {}).get("coordinates")
            if not coords or len(coords) != 2:
                print(f"  ⚠️ Sensor {sensor.get('_id')} missing coordinates")
                continue
            lon, lat = coords
            params = sensor.get("parameters") or {}
            pm25_val = float(params.get("pm25", 0) or 0)
            aqi_val = calculate_aqi(pm25_val)
            map_point = {
                "id": str(sensor.get("_id")),
                "name": sensor.get("name"),
                "description": sensor.get("description"),
                "price": sensor.get("price", 0),
                "city": sensor.get("city") or "Unknown",
                "country": sensor.get("country") or "Unknown",
                "lat": lat,
                "lng": lon,
                "aqi": aqi_val,
                "parameters": params,
                "color": "#00d8ff",
                "source": "sensor",
                # Дополнительные параметры для купленных датчиков
                "co2": float(params.get("co2", 0) or 0),
                "voc": float(params.get("voc", 0) or 0),
                "temp": float(params.get("temp", 0) or 0),
                "hum": float(params.get("hum", 0) or 0),
                "ch2o": float(params.get("ch2o", 0) or 0),
                "co": float(params.get("co", 0) or 0),
                "o3": float(params.get("o3", 0) or 0),
                "no2": float(params.get("no2", 0) or 0),
            }
            map_points.append(map_point)
            print(f"  ✅ Added sensor {map_point['id']} at [{lat}, {lon}]")
        
        print(f"  📊 Total map points: {len(map_points)}")
        return {"data": map_points}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_map_sensors: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.put("/sensors/{sensor_id}/parameters")
async def update_sensor_parameters(
    sensor_id: str,
    pm25: float = None,
    pm10: float = None,
    co2: float = None,
    co: float = None,
    o3: float = None,
    no2: float = None,
    voc: float = None,
    ch2o: float = None,
    temp: float = None,
    hum: float = None,
    current_user: dict = Depends(get_current_user),
):
    """Update sensor parameters. Test with: /sensors/1/parameters?pm25=100&pm10=150"""
    try:
        if not ObjectId.is_valid(sensor_id):
            raise HTTPException(status_code=400, detail="Invalid sensor id")

        # Admin can update any sensor; regular users need sensor_permissions
        is_admin = user_is_admin(current_user)
        if not is_admin:
            user_id = current_user.get("_id")
            if isinstance(user_id, str) and ObjectId.is_valid(user_id):
                user_id = ObjectId(user_id)
            user = await db.users.find_one({"_id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            sensor_permissions = set(user.get("sensor_permissions", []) or [])
            if sensor_id not in sensor_permissions:
                raise HTTPException(status_code=403, detail="You don't have access to this sensor")

        sensor = await db.sensors.find_one({"_id": ObjectId(sensor_id)})
        if not sensor:
            raise HTTPException(status_code=404, detail="Sensor not found")

        parameters = sensor.get("parameters") or {}
        updated_fields = {}
        if pm25 is not None:
            parameters["pm25"] = pm25
            updated_fields["pm25"] = pm25
        if pm10 is not None:
            parameters["pm10"] = pm10
            updated_fields["pm10"] = pm10
        if co2 is not None:
            parameters["co2"] = co2
            updated_fields["co2"] = co2
        if co is not None:
            parameters["co"] = co
            updated_fields["co"] = co
        if o3 is not None:
            parameters["o3"] = o3
            updated_fields["o3"] = o3
        if no2 is not None:
            parameters["no2"] = no2
            updated_fields["no2"] = no2
        if voc is not None:
            parameters["voc"] = voc
            updated_fields["voc"] = voc
        if ch2o is not None:
            parameters["ch2o"] = ch2o
            updated_fields["ch2o"] = ch2o
        if temp is not None:
            parameters["temp"] = temp
            updated_fields["temp"] = temp
        if hum is not None:
            parameters["hum"] = hum
            updated_fields["hum"] = hum

        await db.sensors.update_one(
            {"_id": ObjectId(sensor_id)},
            {"$set": {"parameters": parameters}}
        )

        updated_sensor = await db.sensors.find_one({"_id": ObjectId(sensor_id)})
        return {
            "message": "Sensor parameters updated successfully",
            "sensor": sensor_to_response(updated_sensor),
            "updated_fields": updated_fields,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating sensor: {e}")


# -------------------------
# Device token (long-lived JWT for IoT devices)
# -------------------------
class DeviceTokenRequest(BaseModel):
    email: EmailStr


@app.post("/device/token")
async def create_device_token(
    body: DeviceTokenRequest,
    current_user: dict = Depends(require_admin),
):
    """
    Admin-only: generate a long-lived JWT (365 days) for a device acting on
    behalf of the given user email.  The Raspberry Pi stores this token and
    sends it in every request.
    """
    user = await db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_access_token(
        data={"sub": user["email"], "role": user.get("role", "user")},
        expires_delta=timedelta(days=365),
    )
    return {"access_token": token, "token_type": "bearer", "expires_in_days": 365}


# -------------------------
# Raspberry Pi data ingestion
# -------------------------
@app.post("/data")
async def ingest_sensor_data(
    data: SensorData,
    current_user: dict = Depends(get_current_user),
):
    """
    Receives sensor readings from a Raspberry Pi (or any device).
    Requires a Bearer JWT token so each reading is linked to a user.
    """
    try:
        is_admin, user_oid = safe_get_user_id(current_user)
        user_id_str = str(current_user["_id"])

        # 1. Persist the raw reading in sensor_readings (time-series)
        reading_doc = data.dict()
        reading_doc["user_id"] = user_id_str
        reading_doc["timestamp"] = datetime.utcnow()
        await db.sensor_readings.insert_one(reading_doc)

        # 2. Upsert a sensor document so the reading shows on the map.
        #    Match by device_id; create if it doesn't exist yet.
        existing_sensor = await db.sensors.find_one({"device_id": data.device_id})

        params = {
            "pm25": data.pm25, "pm10": data.pm10, "pm1": data.pm1,
            "co2": data.co2, "voc": data.voc, "temp": data.temp,
            "hum": data.hum, "ch2o": data.ch2o, "co": data.co,
            "o3": data.o3, "no2": data.no2,
        }

        if existing_sensor:
            sensor_id_str = str(existing_sensor["_id"])
            await db.sensors.update_one(
                {"_id": existing_sensor["_id"]},
                {"$set": {"parameters": params, "updated_at": datetime.utcnow()}},
            )
        else:
            # Auto-create a sensor from the device payload
            new_sensor = {
                "device_id": data.device_id,
                "name": data.site or data.device_id,
                "description": f"Auto-created from device {data.device_id}",
                "city": "Almaty",
                "country": "Kazakhstan",
                "location": {"type": "Point", "coordinates": [76.8512, 43.2220]},
                "parameters": params,
                "price": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            result = await db.sensors.insert_one(new_sensor)
            sensor_id_str = str(result.inserted_id)
            print(f"✓ Auto-created sensor '{data.device_id}' -> {sensor_id_str}")

        # 3. Grant the user permission to see this sensor on the map
        if not is_admin and user_oid is not None:
            await db.users.update_one(
                {"_id": user_oid},
                {"$addToSet": {"sensor_permissions": sensor_id_str}},
            )

        print(f"✓ Ingested reading from device={data.device_id} for user={current_user['email']}")
        return {"status": "ok", "device_id": data.device_id, "user": current_user["email"]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in ingest_sensor_data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ingestion error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
