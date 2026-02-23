# Screndly Total Monthly Cost Breakdown

**Last Updated**: December 14, 2024  
**Usage Profile**: Single-user app with moderate automation

---

## 💰 Complete Cost Analysis

### **Infrastructure (Option B)** - $5.40/month

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel (Frontend) | Free | $0 |
| Railway (Backend) | Hobby | $5.00 |
| Neon Postgres | Free | $0 |
| Upstash Redis | Free (optional) | $0 |
| Backblaze B2 | Pay-as-you-go | ~$0.40 |
| **Subtotal** | | **$5.40** |

---

## 🎬 External APIs

### 1. **Shotstack** (Video Rendering) - $9-49/month

**Pricing Tiers**:
```
Free (Sandbox):     $0/month
  • 20 renders/month
  • Watermarked
  • Test mode only
  ❌ Not suitable for production

Starter:           $9/month
  • 50 renders/month
  • No watermark
  • HD quality (1080p)
  ✅ Best for single user starting out

Basic:             $49/month
  • 250 renders/month
  • No watermark
  • HD quality (1080p)
  ✅ If you render more frequently
```

**Realistic Usage** (Single User):
```
Video Studio renders:    10-20/month
Test renders:            5-10/month
Total:                  15-30 renders/month

Recommended: Starter ($9/mo)
```

**Monthly Cost**: **$9/month** (Starter plan)

---

### 2. **TMDb API** (Movie Database) - $0/month ✅

**Pricing**:
```
Free Tier:              $0/month
  • 40 requests/10 seconds
  • Unlimited daily requests
  • Full API access
  ✅ Perfect for Screndly
```

**Realistic Usage** (Single User):
```
Daily anniversary checks:    100 requests/day
Manual searches:             50 requests/day
Total:                      ~4,500 requests/month

Well within free tier limits
```

**Monthly Cost**: **$0/month** ✅ (100% free)

---

### 3. **Google Video Intelligence API** - $5-20/month

**Pricing**:
```
Feature Detection:
  • First 1,000 min/month:  FREE
  • After: $0.10/min

Label Detection:
  • First 1,000 min/month:  FREE
  • After: $0.10/min

Shot Change Detection:
  • First 1,000 min/month:  FREE
  • After: $0.05/min

Text Detection:
  • First 1,000 min/month:  FREE
  • After: $0.15/min
```

**Realistic Usage** (Single User):
```
Scenario 1: Light Use (within free tier)
  • 20 videos/month × 3 min each = 60 min
  • All features = 60 min × 4 = 240 min total
  • Cost: $0 (within 1,000 min free tier)

Scenario 2: Moderate Use
  • 100 videos/month × 3 min = 300 min
  • All features = 300 × 4 = 1,200 min total
  • Free: 1,000 min
  • Paid: 200 min × $0.10 avg = $20
  • Cost: ~$20/month

Scenario 3: Heavy Use
  • 200 videos/month × 3 min = 600 min
  • All features = 600 × 4 = 2,400 min total
  • Free: 1,000 min
  • Paid: 1,400 min × $0.10 avg = $140
  • Cost: ~$140/month
```

**Recommended Strategy**: 
- Use selectively (only when needed)
- Cache results in database
- Prioritize important videos

**Monthly Cost**: **$0-20/month** (depending on usage)

**For single user**: Likely **$0-5/month** if used sparingly

---

### 4. **OpenAI API (ChatGPT)** - $5-30/month

**Pricing** (GPT-4o, GPT-4o-mini):
```
GPT-4o:
  • Input:  $2.50 per 1M tokens
  • Output: $10.00 per 1M tokens

GPT-4o-mini (Recommended for Screndly):
  • Input:  $0.15 per 1M tokens
  • Output: $0.60 per 1M tokens
  ✅ 16× cheaper, still excellent quality

Free Credits:
  • $5 free credits for new accounts (first 3 months)
```

**Realistic Usage** (Single User with GPT-4o-mini):

```
Caption Generation:
  • 50 captions/month
  • ~500 tokens input + 200 tokens output per caption
  • Input:  50 × 500 = 25,000 tokens = $0.004
  • Output: 50 × 200 = 10,000 tokens = $0.006
  • Cost: ~$0.01/month

Comment Replies:
  • 100 replies/month
  • ~300 tokens input + 150 tokens output per reply
  • Input:  100 × 300 = 30,000 tokens = $0.005
  • Output: 100 × 150 = 15,000 tokens = $0.009
  • Cost: ~$0.01/month

Video Studio Prompts:
  • 20 prompts/month
  • ~1,000 tokens input + 500 tokens output per prompt
  • Input:  20 × 1,000 = 20,000 tokens = $0.003
  • Output: 20 × 500 = 10,000 tokens = $0.006
  • Cost: ~$0.01/month

Scene Analysis (if using Vision):
  • 30 images/month
  • ~85 tokens per image + 500 response
  • Input:  30 × 585 = 17,550 tokens = $0.003
  • Output: 30 × 500 = 15,000 tokens = $0.009
  • Cost: ~$0.01/month

Total Monthly (GPT-4o-mini): ~$0.04/month
```

**But realistically**: $5-10/month with normal usage patterns

**Monthly Cost**: **$5-10/month** (GPT-4o-mini)

**Note**: First $5 is free for 3 months for new accounts

---

### 5. **Serper API** (Google Search) - $0-50/month

**Pricing Tiers**:
```
Free Tier:             $0/month
  • 2,500 searches/month
  • Google Search API
  • Image search included
  ✅ Perfect for starting out

Hobby:                 $50/month
  • 30,000 searches/month
  • All features
  • Email support

Pro:                   $200/month
  • 200,000 searches/month
  • Priority support
```

**Realistic Usage** (Single User):

```
RSS Image Enrichment:
  • 50 RSS posts/month need images
  • 1 search per post = 50 searches
  • Cost: FREE (within 2,500 limit)

TMDb Image Enhancement:
  • 30 posts/month need better images
  • 1 search per post = 30 searches
  • Cost: FREE (within 2,500 limit)

Manual Searches:
  • 20 manual searches/month
  • Cost: FREE (within 2,500 limit)

Total: ~100 searches/month (4% of free tier)

---

**With More Aggressive Automation** (RSS every 5 min, Comments every 10 min):

```
RSS automation runs:
  • 12 runs/hour × 24 hours × 30 days = 8,640 runs/month
  • If 10% need image enrichment = 864 searches
  • Cost: FREE (within 2,500 limit)

Comment automation runs:
  • 6 runs/hour × 24 hours × 30 days = 4,320 runs/month
  • No Serper usage
  • Cost: $0

Manual + TMDb:
  • 50 searches/month
  • Cost: FREE

Total: ~914 searches/month (36% of free tier)
```

**Monthly Cost**: **$0/month** ✅ (well within free tier)

**Only upgrade to $50 if**: You exceed 2,500 searches/month (unlikely for single user)

---

### 6. **Google Search Console** - $0/month ✅

**Pricing**:
```
100% FREE - No limits
  ✅ All features included
  ✅ No usage caps
  ✅ API access included
```

**Monthly Cost**: **$0/month** ✅ (completely free)

---

## 📊 **Total Monthly Cost Summary**

### **Conservative Estimate** (Minimal Usage)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| **Infrastructure** | $5.40 | Vercel + Railway + Neon + B2 |
| **Shotstack** | $9.00 | Starter plan (50 renders) |
| **TMDb API** | $0.00 | Free tier |
| **Video Intelligence** | $0.00 | Within free 1,000 min |
| **OpenAI API** | $5.00 | GPT-4o-mini + free credits |
| **Serper API** | $0.00 | Within free 2,500 searches |
| **Search Console** | $0.00 | Always free |
| **TOTAL** | **$19.40/mo** | 💚 Very affordable |

**Annual**: $232.80/year

---

### **Realistic Estimate** (Moderate Usage)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| **Infrastructure** | $5.40 | Same |
| **Shotstack** | $9.00 | Same (50 renders sufficient) |
| **TMDb API** | $0.00 | Free tier sufficient |
| **Video Intelligence** | $5.00 | Occasional overage |
| **OpenAI API** | $10.00 | More caption/comment usage |
| **Serper API** | $0.00 | Still within free tier |
| **Search Console** | $0.00 | Always free |
| **TOTAL** | **$29.40/mo** | 💚 Still very reasonable |

**Annual**: $352.80/year

---

### **Heavy Usage** (Power User)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| **Infrastructure** | $5.40 | Same |
| **Shotstack** | $49.00 | Basic plan (250 renders) |
| **TMDb API** | $0.00 | Free tier sufficient |
| **Video Intelligence** | $20.00 | More video processing |
| **OpenAI API** | $20.00 | Heavy caption/comment usage |
| **Serper API** | $0.00 | Still within free tier |
| **Search Console** | $0.00 | Always free |
| **TOTAL** | **$94.40/mo** | For very active use |

**Annual**: $1,132.80/year

---

## 💡 **Cost Optimization Strategies**

### 1. **Video Intelligence** - Save $5-20/month

**Strategy**: Cache results, use selectively

```typescript
// Only analyze videos that need it
if (!video.hasAnalysis && video.priority === 'high') {
  await analyzeWithVideoIntelligence(video);
}

// Cache results in database
await prisma.videoAnalysis.create({
  data: { videoId, labels, shots, text }
});
```

**Savings**: Keep within free tier ($0 instead of $5-20)

---

### 2. **OpenAI API** - Save $5-15/month

**Strategy A**: Use GPT-4o-mini instead of GPT-4o (16× cheaper)

```typescript
// ✅ Good - Use mini for most tasks
const model = 'gpt-4o-mini';

// ❌ Expensive - Only use full GPT-4o when quality critical
const model = 'gpt-4o'; // 16× more expensive
```

**Strategy B**: Reduce token usage

```typescript
// Optimize prompts to be concise
const prompt = `Generate caption for: ${title}. Keep under 30 words.`;

// Limit output tokens
maxTokens: 100 // Instead of 500
```

**Strategy C**: Cache AI responses

```typescript
// Check cache first
const cached = await redis.get(`caption:${videoId}`);
if (cached) return cached;

// Only call API if no cache
const caption = await openai.chat.completions.create(...);
await redis.setex(`caption:${videoId}`, 86400, caption);
```

**Savings**: $5-15/month with smart caching

---

### 3. **Shotstack** - Save $40/month

**Strategy**: Use Starter plan unless you need more

```
If rendering < 50 videos/month:  Use Starter ($9)
If rendering 50-250/month:       Use Basic ($49)
If testing:                      Use Sandbox (free, watermarked)
```

**Savings**: Stay on Starter plan ($9 instead of $49) until you need it

---

### 4. **Serper** - Save $50/month

**Strategy**: Free tier is 2,500 searches - you'll likely never exceed this

```
Your usage:    ~100 searches/month
Free tier:     2,500 searches/month
Headroom:      25× buffer
```

**Savings**: Never need to upgrade ($0 instead of $50)

---

## 📈 **Cost by Usage Level**

### **Beginner** (First 3 months)
```
Infrastructure:        $5.40
Shotstack:            $9.00
OpenAI (free credits): $0.00 (using free $5)
Other APIs:           $0.00

Total: ~$15/month
```

### **Normal Single User** (Typical)
```
Infrastructure:        $5.40
Shotstack:            $9.00
OpenAI:               $5.00
Video Intelligence:    $0-5.00
Other APIs:           $0.00

Total: ~$20-25/month
```

### **Power User** (Heavy automation)
```
Infrastructure:        $5.40
Shotstack:            $49.00
OpenAI:               $20.00
Video Intelligence:    $20.00
Other APIs:           $0.00

Total: ~$95/month
```

---

## 🎯 **Recommended Starting Budget**

### **Month 1-3**: **$15-20/month**
- Infrastructure: $5.40
- Shotstack Starter: $9
- OpenAI free credits: $0-5

### **Month 4+**: **$20-30/month**
- Infrastructure: $5.40
- Shotstack Starter: $9
- OpenAI: $5-10
- Video Intelligence: $0-5

### **Sustainable Long-term**: **$25-30/month**

---

## 💰 **Cost vs Value**

### What You Get for $25/month:
- ✅ 24/7 automated trailer management
- ✅ RSS feed monitoring (every 30 min)
- ✅ TMDb anniversary detection
- ✅ AI-powered captions & comments
- ✅ Professional video rendering
- ✅ Multi-platform publishing
- ✅ Cloud video storage
- ✅ Real-time notifications
- ✅ Advanced video analysis

### **Compare to Alternatives**:

**Hiring a VA** (Virtual Assistant):
- 10 hours/week at $15/hr = $600/month
- Screndly replaces this → **Save $575/month**

**Other SaaS Tools** (Comparable features):
- Buffer/Hootsuite: $30-100/month
- Canva Pro: $15/month
- Stock video sites: $30-50/month
- Total: $75-165/month
- Screndly: $25/month → **Save $50-140/month**

**Building from Scratch**:
- Development time: 200+ hours
- At $50/hr = $10,000+
- Screndly: Ready to use

---

## 📊 **Cost Projection (First Year)**

```
Month 1-3:  $15/mo × 3 = $45
Month 4-12: $25/mo × 9 = $225

First Year Total: $270

Monthly Average: $22.50/month
```

---

## 🔮 **Future Scaling Costs**

### **If you grow significantly**:

```
Current (single user):
  Infrastructure:  $5.40
  APIs:           $15-25
  Total:          $20-30/month

Small team (2-3 users):
  Infrastructure:  $25-30 (Railway Pro)
  APIs:           $50-100
  Total:          $75-130/month

Agency (10+ users):
  Infrastructure:  $100-200
  APIs:           $200-500
  Total:          $300-700/month
```

**But for single user**: **$20-30/month is sustainable**

---

## ✅ **Final Recommendation**

### **Budget for**: **$25-30/month**

This covers:
- ✅ All infrastructure (reliable, always-on)
- ✅ 50 video renders/month
- ✅ AI captions & comments
- ✅ Basic video analysis
- ✅ All free tier APIs

### **Initial Setup** (One-time):
- Domain name: $12/year (optional)
- **Total one-time**: ~$10-15

### **Annual Cost**: **$300-360/year**

---

## 💡 **Pro Tips**

1. **Start Conservative**: Begin with minimal plans, upgrade only when needed
2. **Monitor Usage**: Check API dashboards monthly
3. **Use Free Tiers**: TMDb, Serper, Search Console are completely free
4. **Cache Aggressively**: Reduce OpenAI/Video Intelligence calls
5. **Set Alerts**: Configure budget alerts in each service
6. **Review Quarterly**: Evaluate if you need to downgrade/upgrade

---

## 🎉 **Bottom Line**

**Expected Monthly Cost**: **$20-30/month**

**This is incredibly affordable** for a production-ready, AI-powered, automated trailer management system that:
- Runs 24/7
- Handles multiple platforms
- Processes videos with AI
- Automates content discovery
- Generates captions & replies
- Stores unlimited videos
- Scales with you

**You're essentially getting an AI assistant + video editor + social media manager for less than the cost of a few coffees per month.** ☕☕

---

**Ready to launch at $25/month?** 🚀