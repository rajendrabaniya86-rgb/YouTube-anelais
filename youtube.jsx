import { useState } from "react";
import { Search, Loader2, AlertCircle, Eye, ThumbsUp, MessageCircle, ArrowLeft, PlayCircle } from "lucide-react";

export default function YouTubeAuditTool() {
  const [apiKey, setApiKey] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [videos, setVideos] = useState([]);
  const [channelInfo, setChannelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [step, setStep] = useState("input"); // input, list, detail

  async function ytFetch(url) {
    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      throw new Error("Network error: request गूगल तक पहुंच नहीं पाई। इंटरनेट चेक करें या दोबारा कोशिश करें। (" + networkErr.message + ")");
    }
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error("सर्वर से जवाब पढ़ने में दिक्कत (HTTP " + res.status + ")");
    }
    if (data.error) {
      const reason = data.error.errors?.[0]?.reason || "";
      throw new Error(`${data.error.message} ${reason ? "(" + reason + ")" : ""} [HTTP ${data.error.code}]`);
    }
    return data;
  }

  async function resolveChannelId(input) {
    let handle = null, channelId = null;
    let clean = input.trim();
    if (clean.includes("youtube.com")) {
      const m1 = clean.match(/channel\/(UC[\w-]+)/);
      const m2 = clean.match(/@([\w.-]+)/);
      if (m1) channelId = m1[1];
      else if (m2) handle = m2[1];
    } else if (clean.startsWith("@")) {
      handle = clean.slice(1);
    } else if (clean.startsWith("UC") && clean.length >= 20) {
      channelId = clean;
    } else {
      handle = clean;
    }

    if (channelId) return channelId;
    const data = await ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`);
    if (!data.items || data.items.length === 0) throw new Error("चैनल नहीं मिला। कृपया सही @handle या Channel ID डालें।");
    return data.items[0].id;
  }

  async function loadChannel() {
    setError(""); setLoading(true); setVideos([]); setChannelInfo(null);
    try {
      if (!apiKey.trim()) throw new Error("कृपया API key डालें।");
      if (!channelInput.trim()) throw new Error("कृपया चैनल का नाम/लिंक/ID डालें।");
      const chId = await resolveChannelId(channelInput);

      const chData = await ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${chId}&key=${apiKey}`);
      if (!chData.items || chData.items.length === 0) throw new Error("चैनल की जानकारी नहीं मिली।");
      const ch = chData.items[0];
      setChannelInfo({
        title: ch.snippet.title,
        thumb: ch.snippet.thumbnails?.default?.url,
        subs: ch.statistics.subscriberCount,
        videoCount: ch.statistics.videoCount,
      });
      const uploadsId = ch.contentDetails.relatedPlaylists.uploads;

      const plData = await ytFetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=15&key=${apiKey}`);
      const videoIds = (plData.items || []).map(i => i.contentDetails.videoId).join(",");
      if (!videoIds) throw new Error("इस चैनल में कोई वीडियो नहीं मिला।");

      const vData = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
      setVideos(vData.items || []);
      setStep("list");
    } catch (e) {
      setError(e.message || "कुछ गड़बड़ हो गई।");
    }
    setLoading(false);
  }

  async function analyzeVideo(video) {
    setSelectedVideo(video);
    setStep("detail");
    setReport("");
    setReportLoading(true);
    try {
      const commentsRes = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video.id}&maxResults=50&order=relevance&key=${apiKey}`);
      const commentsData = await commentsRes.json();
      let comments = [];
      if (!commentsData.error && commentsData.items) {
        comments = commentsData.items.map(c => c.snippet.topLevelComment.snippet.textOriginal);
      }

      const videoData = {
        title: video.snippet.title,
        description: video.snippet.description?.slice(0, 800),
        tags: video.snippet.tags || [],
        views: video.statistics.viewCount,
        likes: video.statistics.likeCount,
        commentCount: video.statistics.commentCount,
        duration: video.contentDetails.duration,
        publishedAt: video.snippet.publishedAt,
        comments: comments.slice(0, 40),
      };

      const prompt = `तुम एक YouTube ग्रोथ एक्सपर्ट हो। नीचे दिए गए वीडियो डेटा को analyze करके हिंदी में एक साफ, सीधी रिपोर्ट दो। रिपोर्ट में ये सेक्शन हों:
1. Title में क्या कमी है (अगर है तो) और बेहतर title सुझाव
2. Description/Tags में क्या कमी है
3. Comments में लोग क्या-क्या शिकायत/समस्या बता रहे हैं (सारांश, थीम के हिसाब से)
4. Views/Likes/Comments के अनुपात से क्या पता चलता है
5. सबसे जरूरी 3 सुधार जो अभी करने चाहिए

नोट: वीडियो की असली ऑडियो/एडिटिंग क्वालिटी तुम सीधे नहीं देख/सुन सकते, इसलिए वह सिर्फ comments में मिले संकेतों से ही बताओ, अंदाज़ा मत लगाओ।

डेटा:
${JSON.stringify(videoData, null, 2)}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map(b => b.text || "").join("\n");
      setReport(text || "रिपोर्ट नहीं बन पाई, कृपया दोबारा कोशिश करें।");
    } catch (e) {
      setReport("गड़बड़ी: " + (e.message || "रिपोर्ट नहीं बन पाई।"));
    }
    setReportLoading(false);
  }

  function formatNum(n) {
    if (!n) return "0";
    n = parseInt(n);
    if (n >= 100000) return (n / 100000).toFixed(1) + "L";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
          <PlayCircle className="text-red-600" /> YouTube चैनल ऑडिट टूल
        </h1>
        <p className="text-sm text-gray-500 mb-4">वीडियो की कमी-कमज़ोरी जानें</p>

        {step === "input" && (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">YouTube API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="अपनी API key यहां पेस्ट करें"
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">चैनल (@handle, लिंक, या Channel ID)</label>
              <input
                type="text"
                value={channelInput}
                onChange={e => setChannelInput(e.target.value)}
                placeholder="जैसे: @mychannel"
                className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button
              onClick={loadChannel}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              {loading ? "लोड हो रहा है..." : "चैनल चेक करें"}
            </button>
          </div>
        )}

        {step === "list" && (
          <div>
            <button onClick={() => setStep("input")} className="text-sm text-gray-600 flex items-center gap-1 mb-3">
              <ArrowLeft size={16} /> वापस
            </button>
            {channelInfo && (
              <div className="bg-white rounded-2xl shadow p-3 flex items-center gap-3 mb-4">
                {channelInfo.thumb && <img src={channelInfo.thumb} className="w-12 h-12 rounded-full" />}
                <div>
                  <p className="font-semibold text-gray-800">{channelInfo.title}</p>
                  <p className="text-xs text-gray-500">{formatNum(channelInfo.subs)} subscribers · {channelInfo.videoCount} videos</p>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-2">किसी वीडियो पर क्लिक करें रिपोर्ट के लिए:</p>
            <div className="space-y-2">
              {videos.map(v => (
                <button
                  key={v.id}
                  onClick={() => analyzeVideo(v)}
                  className="w-full bg-white rounded-xl shadow p-2 flex gap-3 text-left hover:bg-gray-50"
                >
                  <img src={v.snippet.thumbnails?.medium?.url} className="w-24 h-16 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{v.snippet.title}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Eye size={12} />{formatNum(v.statistics.viewCount)}</span>
                      <span className="flex items-center gap-1"><ThumbsUp size={12} />{formatNum(v.statistics.likeCount)}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={12} />{formatNum(v.statistics.commentCount)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "detail" && selectedVideo && (
          <div>
            <button onClick={() => setStep("list")} className="text-sm text-gray-600 flex items-center gap-1 mb-3">
              <ArrowLeft size={16} /> वीडियो लिस्ट पर वापस
            </button>
            <div className="bg-white rounded-2xl shadow p-3 mb-4">
              <img src={selectedVideo.snippet.thumbnails?.medium?.url} className="w-full rounded-lg mb-2" />
              <p className="text-sm font-medium text-gray-800">{selectedVideo.snippet.title}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold text-gray-800 mb-2">📋 ऑडिट रिपोर्ट</h2>
              {reportLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
                  <Loader2 className="animate-spin" size={18} /> रिपोर्ट तैयार हो रही है...
                </div>
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{report}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
