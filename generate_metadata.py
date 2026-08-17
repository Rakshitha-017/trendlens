"""
generate_metadata.py
--------------------
End-to-end metadata pipeline for TrendLens. Run once before generate_embeddings.py.

Steps
─────
  1. Parse train_img_filepath.txt → build per-user profiles
  2. Generate synthetic engagement records → smpd_metadata.json
  3. Validate image existence → enrich → metadata.csv
  4. Add trend_active_until & trend_duration_days → overwrite metadata.csv

Outputs (all in trendlens_outputs/)
────────────────────────────────────
  smpd_metadata.json   — full synthetic engagement records (305 K rows)
  metadata.csv         — valid-images-only enriched DataFrame (69 K rows)

TEMPORAL DESIGN v2:
  Timestamps are now assigned using category-biased Gaussian distributions
  so that different content categories naturally peak at different eras:
    - technology / fashion / sports → 2016-2019  (Rising clusters)
    - travel / food / animals       → 2013-2016  (Stable clusters)
    - architecture / nature / street → 2010-2013 (Declining clusters)
    - Others (portrait, family, etc.) → mixed     (Mixed)
  This produces meaningful temporal diversity enabling genuine
  Rising / Stable / Declining lifecycle classification.
"""

import os, json, random, warnings, math
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Reproducibility ────────────────────────────────────────────────────────────
random.seed(42)
np.random.seed(42)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent
TRAIN_DIR    = BASE_DIR / "train"
FILEPATH_TXT = BASE_DIR / "train_img_filepath.txt"
OUTPUT_DIR   = BASE_DIR / "trendlens_outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

META_JSON = OUTPUT_DIR / "smpd_metadata.json"
META_CSV  = OUTPUT_DIR / "metadata.csv"

print("✓ Config ready. Output dir:", OUTPUT_DIR.resolve())


# ── STEP 1 — Taxonomy, helpers, and user profiles ─────────────────────────────
CATEGORIES = [
    "travel", "food", "portrait", "nature", "architecture",
    "street", "animals", "fashion", "sports", "abstract",
    "nightlife", "family", "events", "art", "technology",
]

CATEGORY_TAGS = {
    "travel":       ["wanderlust", "travel", "vacation", "explore", "adventure"],
    "food":         ["foodie", "instafood", "yummy", "delicious", "foodphotography"],
    "portrait":     ["portrait", "selfie", "model", "face", "people"],
    "nature":       ["nature", "landscape", "outdoors", "greenery", "scenic"],
    "architecture": ["architecture", "building", "urban", "design", "cityscape"],
    "street":       ["streetphotography", "urban", "candid", "street", "city"],
    "animals":      ["animals", "wildlife", "cute", "pets", "nature"],
    "fashion":      ["fashion", "style", "ootd", "outfit", "clothes"],
    "sports":       ["sports", "fitness", "action", "athlete", "workout"],
    "abstract":     ["abstract", "art", "texture", "pattern", "creative"],
    "nightlife":    ["nightlife", "nightout", "party", "club", "lights"],
    "family":       ["family", "kids", "love", "together", "memories"],
    "events":       ["event", "concert", "festival", "wedding", "celebration"],
    "art":          ["art", "painting", "gallery", "creative", "artwork"],
    "technology":   ["tech", "gadgets", "innovation", "digital", "startup"],
}
GENERIC_TAGS = ["photography", "photo", "instagram", "pic", "snapshot", "camera", "moment"]

# Engagement multipliers per category (viral potential)
CAT_LIKES_MU = {
    "food": 3.2, "fashion": 3.0, "portrait": 2.8, "travel": 2.7,
    "events": 2.5, "animals": 2.4, "nightlife": 2.3, "family": 2.2,
    "sports": 2.0, "nature": 1.9, "architecture": 1.8, "street": 1.7,
    "art": 1.6, "abstract": 1.4, "technology": 1.3,
}

# Geo pools (city, lat, lon)
GEO_POOL = [
    ("New York",     40.7128,  -74.0060), ("London",      51.5074,   -0.1278),
    ("Paris",        48.8566,    2.3522), ("Tokyo",       35.6762,  139.6503),
    ("Sydney",      -33.8688,  151.2093), ("Mumbai",      19.0760,   72.8777),
    ("Berlin",       52.5200,   13.4050), ("São Paulo",  -23.5505,  -46.6333),
    ("Toronto",      43.6510,  -79.3470), ("Singapore",    1.3521,  103.8198),
    ("Dubai",        25.2048,   55.2708), ("Barcelona",   41.3851,    2.1734),
    ("Chicago",      41.8781,  -87.6298), ("Seoul",       37.5665,  126.9780),
    ("Melbourne",   -37.8136,  144.9631), ("Cape Town",  -33.9249,   18.4241),
    ("Mexico City",  19.4326,  -99.1332), ("Amsterdam",   52.3676,    4.9041),
    ("Rome",         41.9028,   12.4964), ("Bangkok",     13.7563,  100.5018),
]

FLICKR_GROUPS = [
    "Best of Flickr", "Explore", "World Photography", "Street Shots",
    "Nature & Wildlife", "Urban Landscapes", "Portrait Photography",
    "Travel & Places", "Food Lovers", "Architecture Daily",
    "Black & White", "Golden Hour", "Macro World", "Color Explosion",
    "Documentary Photography",
]

# ── CATEGORY TEMPORAL BIAS — the key change for lifecycle diversity ─────────────
# Each category gets a (mean_year, std_years) Gaussian from which timestamps are
# sampled. Categories with high mean_year → more recent posts → Rising lifecycle.
# Clipped to the epoch 2010–2019.
EPOCH_START = datetime(2010, 1, 1)
EPOCH_END   = datetime(2019, 12, 31)
EPOCH_SPAN  = (EPOCH_END - EPOCH_START).total_seconds()

CATEGORY_TEMPORAL_BIAS = {
    # Rising era — heavy posts in 2016-2019
    "technology": (2017.5, 1.2),
    "fashion":    (2017.0, 1.3),
    "sports":     (2016.5, 1.4),
    # Stable era — posts spread around 2013-2016
    "food":       (2015.0, 1.5),
    "travel":     (2015.5, 1.5),
    "animals":    (2014.5, 1.6),
    # Declining era — heavy posts in 2010-2013
    "architecture": (2011.5, 1.2),
    "nature":       (2011.0, 1.3),
    "street":       (2012.0, 1.4),
    # Mixed — spread across the decade
    "portrait":  (2014.0, 2.5),
    "family":    (2013.5, 2.5),
    "events":    (2014.5, 2.3),
    "art":       (2013.0, 2.5),
    "abstract":  (2015.0, 2.3),
    "nightlife": (2013.5, 2.4),
}


def generate_timestamp(rng_state, category: str) -> str:
    """
    Sample a timestamp for a post using category-biased temporal distribution.

    Each category has a (mean_year, std) Gaussian. This creates era-specific
    activity patterns that produce genuine Rising / Stable / Declining clusters
    after HDBSCAN groups posts by visual similarity.

    The timestamp is clipped to [2010-01-01, 2019-12-31].
    """
    mean_yr, std_yr = CATEGORY_TEMPORAL_BIAS.get(category, (2014.5, 2.5))
    sampled_year_float = float(rng_state.normal(mean_yr, std_yr))
    # Convert fractional year to datetime
    year_frac = sampled_year_float - 2010.0  # offset from epoch start
    seconds   = year_frac * 365.25 * 24 * 3600
    seconds   = max(0.0, min(EPOCH_SPAN, seconds))
    ts = EPOCH_START + timedelta(seconds=seconds)
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ")


print("✓ Taxonomy, helpers and category temporal bias defined.")


# ── Parse train_img_filepath.txt ───────────────────────────────────────────────
raw_lines = FILEPATH_TXT.read_text().strip().splitlines()

records_raw = []
for line in raw_lines:
    line  = line.strip()
    parts = line.split("/")
    if len(parts) < 3:
        continue
    user_id    = parts[1]
    photo_stem = parts[2].replace(".jpg", "").replace(".jpeg", "").replace(".png", "")
    try:
        photo_id_int = int(photo_stem)
    except ValueError:
        continue
    records_raw.append({
        "user_id": user_id, "photo_id": photo_stem,
        "photo_id_int": photo_id_int, "image_path": line,
    })

df_raw  = pd.DataFrame(records_raw)
pid_min = int(df_raw["photo_id_int"].min())
pid_max = int(df_raw["photo_id_int"].max())
print(f"Parsed {len(df_raw):,} entries | photo_id range: [{pid_min}, {pid_max}]")

user_total_posts = df_raw.groupby("user_id")["photo_id"].count().to_dict()

# Build per-user profiles
rng       = np.random.default_rng(42)
all_users = list(df_raw["user_id"].unique())

user_profiles = {}
for uid in all_users:
    user_profiles[uid] = {
        "preferred_cat":  random.choice(CATEGORIES),
        "home_city":      random.choice(GEO_POOL),
        "likes_mult":     float(np.clip(rng.lognormal(0.0, 0.5), 0.3, 6.0)),
        "follower_count": int(np.clip(rng.lognormal(6.5, 1.8), 10, 5_000_000)),
    }

print(f"✓ User profiles built for {len(user_profiles):,} users.")


# ── STEP 2 — Generate synthetic engagement records → smpd_metadata.json ───────
metadata_records = []
_rng = np.random.default_rng(42)

for _, row in df_raw.iterrows():
    uid   = row["user_id"]
    pid   = row["photo_id"]
    pid_i = int(row["photo_id_int"])
    ipath = row["image_path"]
    prof  = user_profiles[uid]

    post_id = f"{uid}_{pid}"

    category = prof["preferred_cat"] if _rng.random() < 0.70 \
               else CATEGORIES[int(_rng.integers(len(CATEGORIES)))]

    # ── Category-biased timestamp ──────────────────────────────────────────────
    ts = generate_timestamp(_rng, category)

    # Likes
    cat_mu  = CAT_LIKES_MU.get(category, 1.5)
    base_mu = math.log(max(cat_mu * prof["likes_mult"] * 20, 1))
    likes   = max(0, int(_rng.lognormal(base_mu, 0.9)))

    # Comments
    beta_frac = float(_rng.beta(1.5, 6.0))
    comments  = max(0, int(likes * beta_frac * 0.25))

    # Views
    views_mult = float(_rng.uniform(10, 120))
    views      = max(likes, int(likes * views_mult))

    # Reposts
    repost_rate = float(_rng.beta(1.2, 18.0))
    reposts     = max(0, int(likes * repost_rate * 0.08))

    # Saves
    save_rate = float(_rng.beta(2.0, 12.0))
    saves     = max(0, int(likes * save_rate * 0.15))

    # Reach
    reach_mult = float(_rng.uniform(0.6, 1.1))
    reach      = max(views, int(views * reach_mult))

    follower_count  = prof["follower_count"]
    engagement_rate = round((likes + comments + reposts) / max(reach, 1) * 100, 4)
    is_viral        = bool(engagement_rate > 3.0 or reposts > 50)

    # Tags
    cat_tag_pool = CATEGORY_TAGS[category]
    n_cat_tags   = int(_rng.integers(2, 6))
    chosen_cat   = _rng.choice(cat_tag_pool,
                               size=min(n_cat_tags, len(cat_tag_pool)),
                               replace=False).tolist()
    n_gen_tags   = int(_rng.integers(0, 3))
    chosen_gen   = _rng.choice(GENERIC_TAGS,
                               size=min(n_gen_tags, len(GENERIC_TAGS)),
                               replace=False).tolist()
    tags = list(dict.fromkeys(chosen_cat + chosen_gen))

    # Groups
    n_groups = int(_rng.integers(0, 5))
    groups   = _rng.choice(FLICKR_GROUPS,
                           size=min(n_groups, len(FLICKR_GROUPS)),
                           replace=False).tolist()

    # Geo (~70 % geotagged)
    if _rng.random() < 0.70:
        city_info             = prof["home_city"] if _rng.random() < 0.60 else random.choice(GEO_POOL)
        city_name, blat, blon = city_info
        geo_lat  = float(blat + _rng.uniform(-0.15, 0.15))
        geo_lon  = float(blon + _rng.uniform(-0.15, 0.15))
        geo_city = city_name
    else:
        geo_lat = geo_lon = geo_city = None

    metadata_records.append({
        "photo_id":         pid,
        "user_id":          uid,
        "post_id":          post_id,
        "image_path":       ipath,
        "timestamp":        ts,
        "likes":            likes,
        "comments":         comments,
        "reposts":          reposts,
        "saves":            saves,
        "views":            views,
        "reach":            reach,
        "follower_count":   follower_count,
        "engagement_rate":  engagement_rate,
        "is_viral":         is_viral,
        "category":         category,
        "tags":             tags,
        "groups":           groups,
        "geo_lat":          geo_lat,
        "geo_lon":          geo_lon,
        "geo_city":         geo_city,
        "user_total_posts": user_total_posts.get(uid, 0),
        "is_synthetic":     True,
    })

print(f"✓ Generated {len(metadata_records):,} synthetic records.")

with open(META_JSON, "w") as f:
    json.dump(metadata_records, f, indent=2)
print(f"✓ Saved → {META_JSON}")


# ── STEP 3 — Build enriched metadata CSV (validate existence + merge) ──────────
base_rows = []
for line in raw_lines:
    line  = line.strip()
    parts = line.split("/")
    if len(parts) < 3:
        continue
    user_id    = parts[1]
    photo_stem = parts[2].replace(".jpg", "").replace(".jpeg", "").replace(".png", "")
    try:
        photo_id_int = int(photo_stem)
    except ValueError:
        continue
    abs_path = str(BASE_DIR / line)
    base_rows.append({
        "post_id":      f"{user_id}_{photo_stem}",
        "user_id":      user_id,
        "photo_id":     photo_stem,
        "photo_id_int": photo_id_int,
        "image_path":   line,
        "abs_path":     abs_path,
    })

df_base = pd.DataFrame(base_rows)
print(f"Base DataFrame: {len(df_base):,} rows")

df_base["file_exists"] = df_base["abs_path"].apply(os.path.isfile)
n_missing = (~df_base["file_exists"]).sum()
if n_missing > 0:
    print(f"⚠  Dropping {n_missing:,} rows with missing files.")
df_valid = df_base[df_base["file_exists"]].copy().reset_index(drop=True)
print(f"Valid images on disk: {len(df_valid):,}")

# Load JSON and merge
with open(META_JSON) as f:
    meta_list = json.load(f)
df_meta = pd.DataFrame(meta_list)
df_meta["tags"]   = df_meta["tags"].apply(json.dumps)
df_meta["groups"] = df_meta["groups"].apply(json.dumps)

df_merged = df_valid.merge(
    df_meta.drop(columns=["image_path"]),
    on=["post_id", "user_id", "photo_id"],
    how="left",
)
df_final = df_merged.drop(columns=["abs_path", "file_exists"], errors="ignore")

print(f"Merged shape: {df_final.shape}")


# ── STEP 4 — Add trend_active_until & trend_duration_days ─────────────────────
CAT_BASE_DAYS = {
    "events":        3,
    "sports":        5,
    "nightlife":     7,
    "animals":       7,
    "food":         14,
    "street":       10,
    "portrait":     10,
    "family":       14,
    "travel":       21,
    "nature":       14,
    "architecture": 21,
    "fashion":      30,
    "abstract":     21,
    "art":          28,
    "technology":   45,
}
DEFAULT_BASE      = 14
MIN_DURATION_DAYS =  1
MAX_DURATION_DAYS = 180

trend_rng = np.random.default_rng(42)

df_final["_eng_proxy"] = (df_final["likes"] + df_final["comments"]) / df_final["views"].clip(lower=1)

like_95th = df_final.groupby("category")["likes"].transform(lambda x: x.quantile(0.95))
df_final["_is_viral_dur"] = df_final["likes"] >= like_95th


def _compute_duration(row: pd.Series) -> float:
    base      = CAT_BASE_DAYS.get(row["category"], DEFAULT_BASE)
    eng       = min(float(row["_eng_proxy"]), 0.20)
    eng_mult  = 0.5 + (eng / 0.20) * 2.5
    viral_mul = float(trend_rng.uniform(2.0, 4.0)) if row["_is_viral_dur"] else 1.0
    mean_days = base * eng_mult * viral_mul
    sigma     = 0.4
    mu        = np.log(max(mean_days, 0.1)) - 0.5 * sigma ** 2
    sampled   = float(trend_rng.lognormal(mu, sigma))
    return float(np.clip(sampled, MIN_DURATION_DAYS, MAX_DURATION_DAYS))


print("Computing trend durations …")
df_final["trend_duration_days"] = df_final.apply(_compute_duration, axis=1)

df_final["trend_active_until"] = (
    pd.to_datetime(df_final["timestamp"], utc=True)
    + pd.to_timedelta(df_final["trend_duration_days"], unit="D")
).dt.strftime("%Y-%m-%dT%H:%M:%SZ")

df_final.drop(columns=["_eng_proxy", "_is_viral_dur"], inplace=True)

# ── Save final CSV ─────────────────────────────────────────────────────────────
df_final.to_csv(META_CSV, index=False)
print(f"✓ Saved enriched metadata → {META_CSV}")

# ── Summary ────────────────────────────────────────────────────────────────────
print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  Final shape            : {df_final.shape}")
print(f"  Columns                : {df_final.columns.tolist()}")
print()
print("  trend_duration_days by category (median days):")
summary = (
    df_final.groupby("category")["trend_duration_days"]
    .median().round(1).sort_values()
)
print(summary.to_string())
print()
print("  Timestamp distribution by category (mean year):")
ts_parsed = pd.to_datetime(df_final["timestamp"])
cat_year  = df_final.copy()
cat_year["year"] = ts_parsed.dt.year
print(cat_year.groupby("category")["year"].mean().round(2).sort_values().to_string())
print()
print("  Overall timestamp distribution (per year):")
print(ts_parsed.dt.year.value_counts().sort_index().to_string())
print()
print("  Sample rows:")
print(
    df_final[["post_id", "category", "timestamp", "trend_duration_days", "trend_active_until"]]
    .head(4)
    .to_string(index=False)
)
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("✓ Metadata pipeline complete.")