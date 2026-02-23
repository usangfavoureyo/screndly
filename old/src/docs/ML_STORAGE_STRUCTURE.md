# ML Training Storage Structure

## Single-User Architecture

Screndly uses a **single-user, privacy-first** architecture. All training data, corrections, and model snapshots are stored locally with optional cloud backup.

## Directory Structure

```
/ml
  /labels
     corrections.jsonl          # All scene corrections (append-only)
  /snapshots
     model_v1.bin               # Baseline model
     model_v2.bin               # Enhanced model (500+ corrections)
     model_v3.bin               # Advanced model (2,500+ corrections)
  training_meta.json            # Training metadata and versioning
```

## corrections.jsonl Format

Each line is a JSON object representing a single correction:

```json
{
  "videoId": "abc123",
  "sceneId": "scene-42",
  "timestamp": "1:23",
  "originalLabel": "action",
  "correctedLabel": "dialogue",
  "confidence": 0.65,
  "audioFeatures": {
    "audioEnergy": 0.42,
    "spectralFlux": 0.31,
    "zeroCrossingRate": 0.18,
    "tempo": 128
  },
  "correctedAt": "2025-11-29T12:34:56Z"
}
```

## training_meta.json Format

```json
{
  "currentVersion": "v1.2-baseline",
  "totalCorrections": 237,
  "currentAccuracy": 72.3,
  "systemRating": 7.2,
  "overrideRate": 18.5,
  "meanHookConfidence": 0.71,
  "lastTraining": "2025-11-15T10:00:00Z",
  "lastBackup": "2025-11-22T08:00:00Z",
  "automationUnlocked": false,
  "stratification": {
    "action": 82,
    "dialogue": 45,
    "suspense": 38,
    "atmosphere": 52,
    "transition": 20
  }
}
```

## Data Retention Policy

**Single-user simplification:** Keep all corrections for life. Never prune.

### Weighting Strategy

- **Recent corrections:** 70% weight (last 100 videos)
- **Historical corrections:** 30% weight (all-time)

This ensures the model learns from your evolving preferences while preserving long-term patterns.

## Automation Unlock Criteria

Full automation (direct publish to X/TikTok/YouTube without manual approval) requires **all 3 criteria:**

1. ✅ **Override rate ≤ 20%** (over last 100 videos)
2. ✅ **Mean hook confidence ≥ 0.75**
3. ✅ **System rating ≥ 8.5** (self-assessed)

## Backup & Safety

### Automatic Backups

- **Weekly automatic backups** to Drive or S3
- **Append-only model versioning** (never overwrite)
- Export dataset + model snapshots weekly (even if no training)

### Manual Export

```
Click "Export Dataset" button in Training Dashboard
  → Downloads: corrections.jsonl + all model snapshots (model_v*.bin)
```

### Cloud Backup

```
Click "Backup to Cloud" button in Training Dashboard
  → Uploads to configured Drive/S3 endpoint
```

## Single Point of Failure Mitigation

Since this is a single-user system, data loss = total loss. **Critical safeguards:**

1. ✅ Weekly automatic backups
2. ✅ Append-only model versioning (rollback capability)
3. ✅ Local + cloud redundancy
4. ✅ Export before major updates

## Accuracy Trajectory

| Stage | Corrections | Accuracy | Notes |
|-------|-------------|----------|-------|
| **Baseline** | 0-499 | 68-75% | Out-of-box, no training |
| **Enhanced** | 500-2,499 | 80-86% | ML training + STT enabled |
| **Advanced** | 2,500+ | 88-92% | Temporal + context-aware model |

## Privacy & Security

**No multi-tenant concerns:**
- No user attribution needed
- No access control tiers
- No privacy consent UX
- No moderation risk
- All data stays local (optional cloud backup)

## Training Pipeline

```
1. User corrects scenes via UI
   ↓
2. Correction appended to corrections.jsonl
   ↓
3. Every 50 corrections → trigger retraining
   ↓
4. New model saved as model_v{N+1}.bin
   ↓
5. Update training_meta.json
   ↓
6. Weekly backup to cloud (automatic)
```

## Reality Check

**Single-user advantages:**
- ✅ Deterministic accuracy improvement (one consistent viewpoint)
- ✅ No variability from external users
- ✅ Can auto-deploy experimental models (no safety gates)
- ✅ Zero moderation risk
- ✅ Simpler, more stable system

**Single-user risks:**
- ⚠️ Data loss = total loss (mitigated by backups)
- ⚠️ No external validation (mitigated by confidence thresholds)
- ⚠️ Single point of failure (mitigated by redundancy)
