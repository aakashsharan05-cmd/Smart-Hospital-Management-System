"""
Dataset Generation Script for Hospital OPD Wait-Time Prediction
Generates a reproducible, clearly labeled synthetic dataset simulating realistic
OPD consultation times and wait times.

Assumptions & Modeling:
1. Queue length is the strongest predictor of wait time.
2. Different departments have distinct baseline consultation durations
   (e.g., Cardiology/Neurology require more in-depth exams than General Medicine).
3. More experienced doctors process consultations slightly faster with lower variance.
4. Peak OPD hours (morning 10:00-13:00, evening 17:00-19:00) and Mondays experience
   additional administrative / triage overhead.
5. Random noise simulates patient-to-patient severity variations.
"""

import os
import numpy as np
import pandas as pd

RANDOM_SEED = 42
NUM_SAMPLES = 10000

DEPARTMENTS = [
    "General Medicine",
    "Cardiology",
    "Orthopedics",
    "Neurology",
    "Pediatrics",
    "Dermatology",
    "ENT",
    "Ophthalmology",
]

# Baseline average consultation duration (minutes) per department
DEPT_BASE_MINUTES = {
    "General Medicine": 8.0,
    "Cardiology": 14.0,
    "Orthopedics": 12.0,
    "Neurology": 15.0,
    "Pediatrics": 7.0,
    "Dermatology": 8.5,
    "ENT": 9.0,
    "Ophthalmology": 9.5,
}

def generate_synthetic_data(num_samples: int = NUM_SAMPLES, seed: int = RANDOM_SEED) -> pd.DataFrame:
    np.random.seed(seed)

    # 1. queue_length: 0 to 15 (skewed towards 1-6)
    queue_length = np.random.choice(
        np.arange(0, 16),
        size=num_samples,
        p=[0.08, 0.14, 0.15, 0.14, 0.12, 0.10, 0.08, 0.06, 0.04, 0.03, 0.02, 0.015, 0.01, 0.007, 0.005, 0.003],
    )

    # 2. day_of_week: 0 (Monday) to 6 (Sunday)
    # Mondays and Saturdays typically have higher footfall
    day_of_week = np.random.choice(
        np.arange(0, 7),
        size=num_samples,
        p=[0.22, 0.16, 0.15, 0.14, 0.14, 0.12, 0.07],
    )

    # 3. hour: 8 to 20 (8 AM to 8 PM)
    # Peak hours around 10-13 and 17-19
    hours_dist = np.array([0.04, 0.07, 0.12, 0.14, 0.12, 0.08, 0.05, 0.06, 0.11, 0.10, 0.07, 0.03, 0.01])
    hours_dist = hours_dist / hours_dist.sum()
    hour = np.random.choice(np.arange(8, 21), size=num_samples, p=hours_dist)

    # 4. department: categorical choice
    department = np.random.choice(DEPARTMENTS, size=num_samples)

    # 5. doctor_experience: 1 to 35 years
    doctor_experience = np.random.randint(1, 36, size=num_samples)

    # Calculate actual_wait_minutes
    actual_wait_minutes = np.zeros(num_samples, dtype=float)

    for i in range(num_samples):
        q = queue_length[i]
        dept = department[i]
        exp = doctor_experience[i]
        dow = day_of_week[i]
        hr = hour[i]

        base_consult_time = DEPT_BASE_MINUTES[dept]

        # Experience discount: doctors with 25+ yrs experience work slightly faster
        exp_discount = (exp - 10) * 0.08  # ~ -1.5 min for 30 yrs, +0.7 min for novice

        effective_consult_time = max(4.0, base_consult_time - exp_discount)

        # Day of week overhead: Mondays (+3m), Saturdays (+1.5m)
        dow_overhead = 3.0 if dow == 0 else (1.5 if dow == 5 else 0.0)

        # Hour peak overhead (triage / nurse handoff delay)
        hour_overhead = 3.5 if (10 <= hr <= 12 or 17 <= hr <= 19) else 1.0

        # Fixed registration check-in processing buffer
        initial_wait = 4.0 if q > 0 else 2.0

        # Unobservable patient complexity noise
        noise = np.random.normal(0, 2.5)

        wait_time = initial_wait + (q * effective_consult_time) + dow_overhead + hour_overhead + noise
        actual_wait_minutes[i] = max(0.0, round(float(wait_time), 1))

    df = pd.DataFrame({
        "queue_length": queue_length,
        "day_of_week": day_of_week,
        "hour": hour,
        "department": department,
        "doctor_experience": doctor_experience,
        "actual_wait_minutes": actual_wait_minutes,
    })

    return df

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    output_path = os.path.join(data_dir, "synthetic_hospital_wait_data.csv")
    print(f"Generating {NUM_SAMPLES} synthetic hospital wait-time records (seed={RANDOM_SEED})...")

    df = generate_synthetic_data(num_samples=NUM_SAMPLES, seed=RANDOM_SEED)
    df.to_csv(output_path, index=False)

    print(f"Successfully saved synthetic dataset to: {output_path}")
    print(f"Shape: {df.shape}")
    print(df.head(5))
    print("\nSummary statistics:")
    print(df.describe())

if __name__ == "__main__":
    main()
