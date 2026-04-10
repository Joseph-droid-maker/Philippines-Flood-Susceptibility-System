import pandas as pd
import json

datasets = r"C:\Users\MAC\Desktop\School\Elective 3 Activity 1 SemiFinal\Final Project\flood-app\Datasets"

df = pd.read_csv(datasets + r"\Philippines_Flood_Final_Predictions.csv")

# Build a clean JSON for the web app
cities = []
for _, row in df.iterrows():
    cities.append({
        "municipality": row["municipality"],
        "province":     row["province"],
        "region":       row["region"],
        "score":        int(row["susceptibility_score"]),
        "label":        row["rf_label"],
        "confidence":   round(float(row["rf_confidence"]) * 100, 1),
        "factors": {
            "elevation":    round(float(row["elevation_mean"]), 1),
            "rainfall":     round(float(row["rainfall_annual_avg"]), 1),
            "population_density": round(float(row["pop_density_per_km2"]), 1),
            "flood_history": int(row["flood_count"]),
            "noah_hazard":  row["noah_hazard_label"]
        },
        "probabilities": {
            "LOW":       round(float(row["prob_LOW"]) * 100, 1),
            "MODERATE":  round(float(row["prob_MODERATE"]) * 100, 1),
            "HIGH":      round(float(row["prob_HIGH"]) * 100, 1),
            "VERY HIGH": round(float(row["prob_VERY HIGH"]) * 100, 1),
            "CRITICAL":  round(float(row["prob_CRITICAL"]) * 100, 1),
        }
    })

output_path = datasets + r"\..\src\floodData.json"
with open(output_path, "w") as f:
    json.dump(cities, f, indent=2)

print(f"✅ Exported {len(cities)} municipalities to floodData.json")
print(f"Sample entry:")
print(json.dumps(cities[0], indent=2))