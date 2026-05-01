from __future__ import annotations

import math
import pickle
from pathlib import Path
from typing import Any, Dict, List, Literal


FEATURE_NAMES = [
    "pm1",
    "pm25",
    "pm10",
    "co2",
    "voc",
    "ch2o",
    "co",
    "o3",
    "no2",
    "temp",
    "humidity",
    "wind_speed",
    "pressure",
]

LEGACY_FIVE_FEATURES = ["pm25", "pm10", "temp", "humidity", "wind_speed"]

MODEL_FILENAME = "almaty_smog_model.pkl"


class SmogModelService:
    def __init__(self) -> None:
        self.model: Any | None = None
        self.model_path = Path(__file__).resolve().parents[2] / MODEL_FILENAME
        self.load_error: str | None = None
        self._load_model()

    def _load_model(self) -> None:
        if not self.model_path.exists():
            self.load_error = f"{MODEL_FILENAME} not found"
            return

        try:
            import joblib

            self.model = joblib.load(self.model_path)
            self.load_error = None
            return
        except Exception as joblib_error:
            self.load_error = f"joblib load failed: {joblib_error}"

        try:
            with self.model_path.open("rb") as model_file:
                self.model = pickle.load(model_file)
            self.load_error = None
        except Exception as pickle_error:
            self.model = None
            self.load_error = f"{self.load_error}; pickle load failed: {pickle_error}"

    def predict(self, payload: Dict[str, float]) -> Dict[str, Any]:
        features = self._clean_features(payload)
        predicted_aqi = self._predict_with_model(features)
        model_used: Literal["almaty_smog_model.pkl", "rule_based_fallback"] = MODEL_FILENAME

        if predicted_aqi is None:
            predicted_aqi = self._rule_based_aqi(features)
            model_used = "rule_based_fallback"

        predicted_aqi = int(max(0, min(500, round(predicted_aqi))))
        danger_level = danger_level_for_aqi(predicted_aqi)
        main_pollutant = main_pollutant_for_features(features)

        return {
            "predicted_aqi": predicted_aqi,
            "danger_level": danger_level,
            "main_pollutant": main_pollutant,
            "recommendation": recommendation_for_level(danger_level, main_pollutant),
            "model_used": model_used,
        }

    def _clean_features(self, payload: Dict[str, float]) -> Dict[str, float]:
        cleaned: Dict[str, float] = {}
        for name in FEATURE_NAMES:
            value = payload.get(name, 0)
            try:
                number = float(value)
            except (TypeError, ValueError):
                number = 0.0
            cleaned[name] = number if math.isfinite(number) else 0.0
        return cleaned

    def _predict_with_model(self, features: Dict[str, float]) -> float | None:
        if self.model is None:
            return None

        model_feature_names = self._model_feature_names()
        row = [features[name] for name in model_feature_names]
        inputs: List[Any] = [[row]]

        try:
            import pandas as pd

            inputs.insert(0, pd.DataFrame([{name: features[name] for name in model_feature_names}], columns=model_feature_names))
        except Exception:
            pass

        for model_input in inputs:
            try:
                result = self.model.predict(model_input)
                value = result[0] if hasattr(result, "__getitem__") else result
                value_float = float(value)
                if math.isfinite(value_float):
                    return value_float
            except Exception as predict_error:
                self.load_error = f"model predict failed: {predict_error}"
        return None

    def _model_feature_names(self) -> List[str]:
        fitted_names = getattr(self.model, "feature_names_in_", None)
        if fitted_names is not None:
            names = [str(name) for name in fitted_names]
            if all(name in FEATURE_NAMES for name in names):
                return names

        expected_count = getattr(self.model, "n_features_in_", len(FEATURE_NAMES))
        if expected_count == 5:
            return LEGACY_FIVE_FEATURES
        return FEATURE_NAMES[: int(expected_count)]

    def _rule_based_aqi(self, features: Dict[str, float]) -> float:
        pm25_aqi = aqi_from_pm25(features["pm25"])
        pm10_aqi = aqi_from_pm10(features["pm10"])
        gas_penalty = 0
        if features["co2"] > 1200:
            gas_penalty += 15
        if features["voc"] > 0.5:
            gas_penalty += 10
        if features["no2"] > 100:
            gas_penalty += 20
        if features["o3"] > 70:
            gas_penalty += 15
        return max(pm25_aqi, pm10_aqi) + gas_penalty


def aqi_from_pm25(pm25: float) -> float:
    if pm25 <= 12:
        return (50 / 12) * pm25
    if pm25 <= 35.4:
        return 50 + ((100 - 50) / (35.4 - 12)) * (pm25 - 12)
    if pm25 <= 55.4:
        return 100 + ((150 - 100) / (55.4 - 35.4)) * (pm25 - 35.4)
    if pm25 <= 150.4:
        return 150 + ((200 - 150) / (150.4 - 55.4)) * (pm25 - 55.4)
    if pm25 <= 250.4:
        return 200 + ((300 - 200) / (250.4 - 150.4)) * (pm25 - 150.4)
    return 300 + ((500 - 300) / (500.4 - 250.4)) * (pm25 - 250.4)


def aqi_from_pm10(pm10: float) -> float:
    if pm10 <= 54:
        return (50 / 54) * pm10
    if pm10 <= 154:
        return 50 + ((100 - 50) / (154 - 55)) * (pm10 - 55)
    if pm10 <= 254:
        return 100 + ((150 - 100) / (254 - 155)) * (pm10 - 155)
    if pm10 <= 354:
        return 150 + ((200 - 150) / (354 - 255)) * (pm10 - 255)
    if pm10 <= 424:
        return 200 + ((300 - 200) / (424 - 355)) * (pm10 - 355)
    return 300 + ((500 - 300) / (604 - 425)) * (pm10 - 425)


def danger_level_for_aqi(aqi: int) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def main_pollutant_for_features(features: Dict[str, float]) -> str:
    scores = {
        "PM2.5": features["pm25"] / 35.4,
        "PM10": features["pm10"] / 154,
        "CO2": features["co2"] / 1200,
        "VOC": features["voc"] / 0.5,
        "CH2O": features["ch2o"] / 0.1,
        "CO": features["co"] / 9,
        "O3": features["o3"] / 70,
        "NO2": features["no2"] / 100,
    }
    return max(scores, key=scores.get)


def recommendation_for_level(level: str, pollutant: str) -> str:
    if level == "Good":
        return "Air quality is good. Normal outdoor activity is fine."
    if level == "Moderate":
        return f"Air is acceptable, but watch {pollutant}. Sensitive people should limit long outdoor exposure."
    if level == "Unhealthy for Sensitive Groups":
        return f"{pollutant} is elevated. Children, older adults, and people with respiratory conditions should reduce outdoor activity."
    if level == "Unhealthy":
        return f"Reduce outdoor activity and close windows. Consider filtration while {pollutant} remains high."
    if level == "Very Unhealthy":
        return f"Avoid prolonged outdoor exposure. Use a respirator outdoors and indoor filtration if available. Main concern: {pollutant}."
    return f"Hazardous air quality. Stay indoors, seal windows, and use filtration. Main concern: {pollutant}."


smog_model_service = SmogModelService()
