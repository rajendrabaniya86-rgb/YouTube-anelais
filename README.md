# YT Autopilot

YouTube चैनल ग्रोथ ऑटोमेशन — रोज़ अपने-आप कंटेंट लिखता है, वीडियो (Shorts + Long) बनाता है,
SEO टाइटल/डिस्क्रिप्शन/टैग/हैशटैग बनाता है, YouTube पर अपलोड करता है और चैनल एनालिटिक्स से
"कमी–कमज़ोरी" रिपोर्ट देता है। पूरा स्टैक फ्री टियर पर चलता है।

## क्या-क्या होता है

| स्टेप | टूल | कॉस्ट |
|---|---|---|
| स्क्रिप्ट + आइडिया | Google Gemini API | फ्री टियर |
| कीवर्ड रिसर्च | YouTube autocomplete | फ्री, बिना key |
| SEO मेटाडेटा | Gemini | फ्री टियर |
| वॉइसओवर | Edge neural TTS (`edge-tts`) | फ्री, बिना key |
| विजुअल्स | Pexels API (न हो तो जनरेटेड ग्रेडिएंट) | फ्री |
| रेंडरिंग | ffmpeg | फ्री |
| अपलोड | YouTube Data API v3 | फ्री कोटा |
| एनालिटिक्स रिपोर्ट | YouTube Analytics API + Gemini | फ्री |
| शेड्यूलिंग | APScheduler या GitHub Actions cron | फ्री |

## सेटअप

```bash
pip install -r requirements.txt          # ffmpeg भी इंस्टॉल होना चाहिए
cp .env.example .env                     # keys भरें
python scripts/authorize_youtube.py      # YOUTUBE_REFRESH_TOKEN निकालें
uvicorn app.main:app --reload            # http://localhost:8000 डैशबोर्ड
```

Keys कहाँ से लें:
- `GEMINI_API_KEY` — https://aistudio.google.com/app/apikey
- `PEXELS_API_KEY` — https://www.pexels.com/api/ (ऑप्शनल)
- `YOUTUBE_CLIENT_ID` / `SECRET` — Google Cloud Console → YouTube Data API v3 +
  YouTube Analytics API enable → OAuth client (Desktop app)

## चलाना

- डैशबोर्ड बटन: "अभी बनाओ और पोस्ट करो" / "सिर्फ़ वीडियो बनाओ" / रिपोर्ट रिफ्रेश
- CLI: `python scripts/run_daily.py` (`--no-upload` से सिर्फ़ रेंडर)
- ऑटोमैटिक रोज़: ऐप चलती रहे तो `POST_HOUR_UTC` पर, या फ्री में
  `.github/workflows/daily.yml` (repo secrets सेट करें)

## API

| रूट | काम |
|---|---|
| `GET /` | डैशबोर्ड |
| `POST /api/run?upload=true` | पूरा पाइपलाइन रन |
| `POST /api/report` | एनालिटिक्स कमज़ोरी रिपोर्ट |
| `GET /api/keywords?seed=...` | कीवर्ड रिसर्च |
| `GET /api/videos` | बने हुए वीडियो |

## नोट

- YouTube API का डिफ़ॉल्ट कोटा (10,000 units/day) में लगभग 6 अपलोड/दिन आते हैं।
- नया OAuth ऐप "Testing" मोड में हो तो refresh token 7 दिन में एक्सपायर होता है —
  ऐप को "In production" कर दें।
- डैशबोर्ड डिफ़ॉल्ट रूप से localhost पर ही चलाएँ। बाहर एक्सपोज़ करना हो तो `DASHBOARD_TOKEN`
  सेट करें और `/?token=<value>` से खोलें — वरना कोई भी आपके चैनल पर वीडियो पोस्ट करा सकता है।
- कस्टम थंबनेल के लिए चैनल verified होना ज़रूरी है; न हो तो अपलोड फिर भी चलेगा।
