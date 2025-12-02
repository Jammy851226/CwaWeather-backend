require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 城市英文代號 → CWA 中文名稱
const cityMap = {
  taipei: "臺北市",
  newtaipei: "新北市",
  taoyuan: "桃園市",
  taichung: "臺中市",
  tainan: "臺南市",
  kaohsiung: "高雄市",
  keelung: "基隆市",
  hsinchu: "新竹市",
  miaoli: "苗栗縣",
  changhua: "彰化縣",
  nantou: "南投縣",
  yunlin: "雲林縣",
  chiayi: "嘉義市",
  chiayiCounty: "嘉義縣",
  pingtung: "屏東縣",
  yilan: "宜蘭縣",
  hualien: "花蓮縣",
  taitung: "臺東縣",
  penghu: "澎湖縣",
  kinmen: "金門縣",
  lienchiang: "連江縣",
};

/**
 * 取得高雄天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
// 動態路由：支援多縣市
const getWeatherByCity = async (req, res) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    const cityKey = req.params.city.toLowerCase();
    const locationName = cityMap[cityKey];

    if (!locationName) {
      return res.status(400).json({
        error: "不支援的城市",
        message: `目前不支援 ${req.params.city}`,
      });
    }

    // 呼叫 CWA API - 一般天氣預報（36小時）
    // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-D0047-091`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName,
        },
      }
    );

    // 取得某地區的天氣資料
    const locationData = response.data.records.Locations[0].Location.find((loc) => loc.LocationName === locationName);
    //console.log(locationData);

    if (!locationData) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得該地區天氣資料",
      });
    }

    // 整理天氣資料
    const weatherData = {
      city: locationData.LocationName,
      //updateTime: response.data.records.DatasetDescription,
      forecasts: [],
    };

    // 解析天氣要素
    const weatherElements = locationData.WeatherElement;
    const timeCount = Math.min(weatherElements[0].Time.length, 7);

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].Time[i].StartTime,
        endTime: weatherElements[0].Time[i].EndTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
        humidity: "",
        UV: "",
      };

      weatherElements.forEach((element) => {
      const timeData = element.Time[i];
      if (!timeData) return;
      if (!timeData.ElementValue || timeData.ElementValue.length === 0) return; // 沒有值就跳過
      
      const value = timeData.ElementValue[0];
      switch (element.ElementName) {
      case "紫外線指數":
        forecast.UV = value.UVExposureLevel;
        break;
      case "最高溫度":
        forecast.maxTemp = value.MaxTemperature + "°C";
        break;
      case "最低溫度":
        forecast.minTemp = value.MinTemperature + "°C";
        break;
      case "平均相對濕度":
        forecast.humidity = value.RelativeHumidity + "%";
        break;
      case "12小時降雨機率":
        forecast.rain = value.ProbabilityOfPrecipitation + "%";
        break;
      case "風速":
        forecast.windSpeed = value.WindSpeed;
        break;
      case "天氣現象":
        forecast.weather = value.Weather;
        break;
      case "最大舒適度指數":
        forecast.comfort = value.MaxComfortIndexDescription;
        break;
      }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      kaohsiung: "/api/weather/kaohsiung",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 動態取得各縣市天氣
app.get("/api/weather/:city", getWeatherByCity);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
