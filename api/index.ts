import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose, { Schema, Document, Model } from 'mongoose';
import puppeteer from 'puppeteer';
import { GoogleGenAI } from "@google/genai";

// --- CONFIGURATION ---

const { MONGODB_URI, API_KEY, ALPHA_VANTAGE_API_KEY } = process.env;
if (!MONGODB_URI || !API_KEY || !ALPHA_VANTAGE_API_KEY) {
    console.error("CRITICAL ERROR: Missing MONGODB_URI, API_KEY, or ALPHA_VANTAGE_API_KEY in environment variables.");
    process.exit(0);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "NZD", "CAD", "JPY", "CHF"];
const SOURCE_CONFIG: { [currency: string]: { [indicator: string]: string[] } } = {
    "USD": { "Manufacturing PMI": ["https://tradingeconomics.com/united-states/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/united-states/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/united-states/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/united-states/business-confidence"], "CPI": ["https://tradingeconomics.com/united-states/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/united-states/money-supply-m2"], "Central Bank": ["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=EURUSD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/united-states/retail-sales"], "JOLTS Job Openings": ["https://tradingeconomics.com/united-states/job-offers"], "Unemployment Claims": ["https://tradingeconomics.com/united-states/jobless-claims"], "ADP Employment Change": ["https://tradingeconomics.com/united-states/adp-employment-change"], "Average Hourly Earnings YoY": ["https://tradingeconomics.com/united-states/average-hourly-earnings-yoy"], "Core PPI YoY": ["https://tradingeconomics.com/united-states/core-producer-prices-yoy"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/united-states/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/united-states/unemployment-rate"], "Employment Change / NFP": ["https://tradingeconomics.com/united-states/non-farm-payrolls"], "Job Vacancies": ["https://tradingeconomics.com/united-states/job-vacancies"] },
    "EUR": { "Manufacturing PMI": ["https://tradingeconomics.com/euro-area/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/euro-area/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/euro-area/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/euro-area/business-confidence"], "CPI": ["https://tradingeconomics.com/euro-area/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/euro-area/money-supply-m2"], "Central Bank": ["https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=EURUSD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/euro-area/retail-sales"], "Core PPI YoY": ["https://tradingeconomics.com/euro-area/producer-price-inflation-mom"], "Average Monthly Earnings": ["https://tradingeconomics.com/euro-area/wages"], "Job Vacancy Rate": ["https://tradingeconomics.com/euro-area/job-vacancy-rate"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/euro-area/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/euro-area/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/euro-area/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/euro-area/job-vacancies"] },
    "GBP": { "Manufacturing PMI": ["https://tradingeconomics.com/united-kingdom/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/united-kingdom/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/united-kingdom/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/united-kingdom/business-confidence"], "CPI": ["https://tradingeconomics.com/united-kingdom/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/united-kingdom/money-supply-m2"], "Central Bank": ["https://www.bankofengland.co.uk/monetary-policy-report-and-interim-reports"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=GBPUSD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/united-kingdom/retail-sales"], "Average Weekly Wages": ["https://tradingeconomics.com/united-kingdom/wages"], "Core PPI YoY": ["https://tradingeconomics.com/united-kingdom/core-producer-prices"], "Claimant Count": ["https://tradingeconomics.com/united-kingdom/claimant-count-change"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/united-kingdom/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/united-kingdom/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/united-kingdom/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/united-kingdom/job-vacancies"] },
    "AUD": { "Money Supply": ["https://tradingeconomics.com/australia/money-supply-m3"], "Manufacturing PMI": ["https://tradingeconomics.com/australia/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/australia/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/australia/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/australia/business-confidence"], "CPI": ["https://tradingeconomics.com/australia/consumer-price-index-cpi"], "Central Bank": ["https://www.rba.gov.au/media-releases/"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=AUDUSD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/australia/retail-sales"], "Core PPI YoY": ["https://tradingeconomics.com/australia/producer-prices"], "Average Weekly Wages": ["https://tradingeconomics.com/australia/wages"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/australia/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/australia/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/australia/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/australia/job-vacancies"] },
    "NZD": { "Money Supply": ["https://tradingeconomics.com/new-zealand/money-supply-m3"], "Manufacturing PMI": ["https://tradingeconomics.com/new-zealand/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/new-zealand/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/new-zealand/consumer-confidence"], "CPI": ["https://tradingeconomics.com/new-zealand/inflation-cpi"], "Unemployment Rate": ["https://tradingeconomics.com/new-zealand/unemployment-rate"], "Job Vacancies": ["https://tradingeconomics.com/new-zealand/job-vacancies"], "Employment Change": ["https://tradingeconomics.com/new-zealand/employment-change"], "Retail Sales M/M": ["https://tradingeconomics.com/new-zealand/retail-sales"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/new-zealand/gdp-growth"], "Business Confidence": ["https://tradingeconomics.com/new-zealand/business-confidence"], "Central Bank": ["https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=NZDUSD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Core PPI YoY": ["https://tradingeconomics.com/new-zealand/producer-prices"], "Average Hourly Earnings YoY": ["https://tradingeconomics.com/new-zealand/wages"] },
    "CAD": { "Manufacturing PMI": ["https://tradingeconomics.com/canada/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/canada/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/canada/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/canada/business-confidence"], "CPI": ["https://tradingeconomics.com/canada/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/canada/money-supply-m2"], "Central Bank": ["https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDCAD"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/canada/retail-sales"], "Core PPI YoY": ["https://tradingeconomics.com/canada/producer-prices"], "Average Weekly Earnings": ["https://tradingeconomics.com/canada/average-weekly-earnings"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/canada/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/canada/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/canada/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/canada/job-vacancies"] },
    "JPY": { "Manufacturing PMI": ["https://tradingeconomics.com/japan/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/japan/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/japan/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/japan/business-confidence"], "CPI": ["https://tradingeconomics.com/japan/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/japan/money-supply-m2"], "Central Bank": ["https://www.boj.or.jp/en/mopo/mpmdeci/index.htm"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDJPY"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/japan/retail-sales"], "Core PPI YoY": ["https://tradingeconomics.com/japan/producer-prices-change"], "Average Monthly Wages": ["https://tradingeconomics.com/japan/wages"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/japan/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/japan/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/japan/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/japan/job-vacancies"] },
    "CHF": { "Manufacturing PMI": ["https://tradingeconomics.com/switzerland/manufacturing-pmi"], "Services PMI": ["https://tradingeconomics.com/switzerland/services-pmi"], "Consumer Confidence": ["https://tradingeconomics.com/switzerland/consumer-confidence"], "Business Confidence": ["https://tradingeconomics.com/switzerland/business-confidence"], "CPI": ["https://tradingeconomics.com/switzerland/consumer-price-index-cpi"], "Money Supply": ["https://tradingeconomics.com/switzerland/money-supply-m2"], "Central Bank": ["https://www.snb.ch/en/i-publications/snb-news/monetary-policy-assessments"], "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"], "COT": ["https://market-bulls.com/cot-report/"], "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDCHF"], "Event Modifiers": ["https://tradingeconomics.com/ws/stream.ashx?start=0&size=20"], "Retail Sales M/M": ["https://tradingeconomics.com/switzerland/retail-sales"], "Core PPI YoY": ["https://tradingeconomics.com/switzerland/producer-prices"], "Gross Monthly Wage": ["https://tradingeconomics.com/switzerland/wages"], "GDP Q/Q Annualized": ["https://tradingeconomics.com/switzerland/gdp"], "Unemployment Rate": ["https://tradingeconomics.com/switzerland/unemployment-rate"], "Employment Change": ["https://tradingeconomics.com/switzerland/employment-change"], "Job Vacancies": ["https://tradingeconomics.com/switzerland/job-vacancies"] }
};
const SCORING_RULES: { [indicator: string]: string[] } = {
    "Manufacturing PMI": ["above 50 rising: +2", "below 50 rising: -1", "above 50 declining: +1", "below 50 declining: -2"],
    "Services PMI": ["above 50 rising: +2", "below 50 rising: -1", "above 50 declining: +1", "below 50 declining: -2"],
    "Consumer Confidence": ["rising quickly: +2", "rising slowly: +1", "when reaching former top or stagnating: 0", "falling slowly: -1", "falling quickly and continuously: -2"],
    "CPI": ["Target is 2%", "above 2% rising: +2", "above 2% falling: +1", "at 2% +/-0: 0", "below 2% rising: -1", "below 2% falling: -2"],
    "Money Supply": ["declining fast: +2", "declining slow: +1", "stagnating: 0", "rising slow: -1", "rising fast: -2", "Note: For AUD & NZD use M3, others M2."],
    "Central Bank": ["+2 (Very Hawkish): Hiking rates, QT active, explicit hike guidance.", "+1 (Hawkish): Leaning towards tightening.", "0 (Neutral): Holding rates, data-dependent guidance.", "-1 (Dovish): Leaning towards easing.", "-2 (Very Dovish): Cutting rates, QE active, explicit cut guidance."],
    "Seasonality": ["Look 4 to 6 weeks in the future.", "only up: +2", "up then down: +1", "sideways: 0", "down then up: -1", "only down: -2"],
    "COT": ["65%-100% long: +2", "51%-65% long: +1", "exact 50%/50% long/short: 0", "51%-65% short: -1", "65%-100% short: -2"],
    "Retail Sentiment": ["65%-100% long: -2 (Contrarian)", "51%-65% long: -1 (Contrarian)", "exact 50%/50% long/short: 0", "51%-65% short: +1 (Contrarian)", "65%-100% short: +2 (Contrarian)"],
    "Strong vs Weak": ["far above (0): +2", "slightly above (0): +1", "flat around the (0): 0", "slightly below (0): -1", "far below (0): -2", "Note sudden shifts!"]
};
const PROMPTS = {
    scoring: (indicator: string, currency: string, rules: string, data: string) => `Analyze the economic data for ${currency} regarding "${indicator}". Based on the rules and data, determine a score from -2 to +2. Respond ONLY with a valid JSON object: {"score": <number>, "rationale": "<brief reasoning>"}. \n\nRules: ${rules}\n\nData: ${data}`,
    recap: (currency: string, indicatorData: string, eventsStream: string) => `Analyze the scored data for ${currency}: ${indicatorData}. Also consider the following live economic events stream for context: ${eventsStream}. Provide an economic recap. Respond ONLY with a valid JSON object: {"bias": "<string>", "narrativeReasoning": "<string>", "eventModifiers": [{"heading": "<string>", "flag": "<'Green Flag'|'Yellow Flag'|'Red Flag'>", "description": "<string>"}]}`,
};
const VALID_BIAS_VALUES = ["Very Bullish", "Bullish", "Neutral", "Bearish", "Very Bearish"];

// --- DATABASE SETUP ---
mongoose.set('strictQuery', true);

const ScoreSchema = new Schema({ score: { type: Number, required: true }, rationale: { type: String, required: true } }, { _id: false });
const EventModifierSchema = new Schema({ heading: String, flag: String, description: String }, { _id: false });
const EconomicRecapSchema = new Schema({ bias: String, narrativeReasoning: String, eventModifiers: [EventModifierSchema] }, { _id: false });
const CurrencyAnalysisSchema = new Schema({ scores: { type: Map, of: ScoreSchema }, baseScore: Number, direction: String, recap: EconomicRecapSchema, eventModifierScore: { type: Number, default: 0 }, riskModifier: { type: Number, default: 0 } }, { _id: false });
interface IAnalysis extends Document { date: string; data: Map<string, any>; }
const AnalysisSchema = new Schema<IAnalysis>({ date: { type: String, required: true, unique: true, index: true }, data: { type: Map, of: CurrencyAnalysisSchema } });
const Analysis: Model<IAnalysis> = mongoose.models.Analysis || mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

interface IOverride extends Document {
    timestamp: Date; type: 'score' | 'bias'; currencyCode: string; indicator?: string;
    originalValue: string | number; overriddenValue: string | number; justification?: string;
}
const OverrideSchema = new Schema<IOverride>({
    timestamp: { type: Date, default: Date.now }, type: { type: String, enum: ['score', 'bias'], required: true },
    currencyCode: { type: String, required: true }, indicator: { type: String },
    originalValue: { type: Schema.Types.Mixed, required: true }, overriddenValue: { type: Schema.Types.Mixed, required: true },
    justification: { type: String },
});
const Override: Model<IOverride> = mongoose.models.Override || mongoose.model<IOverride>('Override', OverrideSchema);

const connectDB = async () => { if (mongoose.connection.readyState === 0) { await mongoose.connect(MONGODB_URI); } };

// --- CORE LOGIC ---
const cleanHtml = (html: string): string => html.replace(/<style[^>]*>.*<\/style>/gs, '').replace(/<script[^>]*>.*<\/script>/gs, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function scrapeUrl(url: string): Promise<string> {
    let browser;
    try {
        console.log(`Scraping: ${new URL(url).hostname}`);
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage(); await page.goto(url, { waitUntil: 'networkidle2' });
        const content = await page.content(); await browser.close();
        return cleanHtml(content);
    } catch (error) { if (browser) await browser.close(); console.error(`Failed to scrape ${url}:`, error); return ''; }
}

async function callAI(prompt: string): Promise<any> {
    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        const text = response.text;
        if (!text) {
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            console.error("AI Response Error:", { finishReason, safetyRatings });
            throw new Error(`AI response was empty or blocked. Finish Reason: ${finishReason}`);
        }
        const cleanedText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(cleanedText);
    } catch (error) { console.error("AI call failed:", error); throw new Error(`Failed to get a valid JSON response from AI. ${error instanceof Error ? error.message : ''}`); }
}

type IndicatorDataPoint = { date: string; value: number; }; type RiskSignal = 'Risk-On' | 'Risk-Off' | 'Neutral';
const calculateSMA = (data: IndicatorDataPoint[], period: number): IndicatorDataPoint[] => {
    if (data.length < period) return []; const sma: IndicatorDataPoint[] = [];
    for (let i = period - 1; i < data.length; i++) { const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.value, 0); sma.push({ date: data[i].date, value: sum / period }); }
    return sma;
};
async function fetchAlphaVantage(params: URLSearchParams): Promise<any> {
    params.append('apikey', ALPHA_VANTAGE_API_KEY!);
    const response = await fetch(`https://www.alphavantage.co/query?${params.toString()}`);
    if (!response.ok) throw new Error(`Alpha Vantage API request failed: ${response.status}`);
    const data = await response.json();
    if (data['Error Message'] || data['Information']) throw new Error(`Alpha Vantage API error: ${data['Error Message'] || data['Information']}`);
    return data;
}
const analyzeTrend = (data: IndicatorDataPoint[]) => {
    const sma20 = calculateSMA(data, 20); const sma50 = calculateSMA(data, 50);
    if (sma20.length === 0 || sma50.length === 0) return 'Neutral';
    const latestPrice = data[data.length - 1]?.value; const latestSma20 = sma20[sma20.length - 1]?.value; const latestSma50 = sma50[sma50.length - 1]?.value;
    if (latestPrice > latestSma20 && latestSma20 > latestSma50) return 'Risk-On';
    if (latestPrice < latestSma20 && latestSma20 < latestSma50) return 'Risk-Off';
    return 'Neutral';
};
async function fetchAndAnalyzeRiskSentiment(): Promise<number> {
    console.log('Analyzing market risk sentiment...');
    try {
        const [spxData, vixData, audjpyData, us10yData] = await Promise.all([
            fetchAlphaVantage(new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol: 'SPY', outputsize: 'compact' })).then(d => Object.entries(d['Time Series (Daily)']).map(([date, v]: [string, any]) => ({ date, value: parseFloat(v['4. close']) })).reverse()),
            fetchAlphaVantage(new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol: 'VIXY', outputsize: 'compact' })).then(d => Object.entries(d['Time Series (Daily)']).map(([date, v]: [string, any]) => ({ date, value: parseFloat(v['4. close']) })).reverse()),
            fetchAlphaVantage(new URLSearchParams({ function: 'FX_DAILY', from_symbol: 'AUD', to_symbol: 'JPY', outputsize: 'compact' })).then(d => Object.entries(d['Time Series FX (Daily)']).map(([date, v]: [string, any]) => ({ date, value: parseFloat(v['4. close']) })).reverse()),
            fetchAlphaVantage(new URLSearchParams({ function: 'TREASURY_YIELD', interval: 'daily', maturity: '10year' })).then(d => d.data.map((item: any) => ({ date: item.date, value: parseFloat(item.value) })).filter((i: any) => !isNaN(i.value)).reverse()),
        ]);
        const latestVix = vixData[vixData.length - 1]?.value;
        const signals: RiskSignal[] = [ analyzeTrend(spxData), latestVix < 20 ? 'Risk-On' : latestVix > 25 ? 'Risk-Off' : 'Neutral', analyzeTrend(audjpyData), analyzeTrend(us10yData) ];
        const summary = { on: signals.filter(s => s === 'Risk-On').length, off: signals.filter(s => s === 'Risk-Off').length };
        if (summary.on >= 3) return 1; if (summary.off >= 3) return -1;
        return 0;
    } catch (error) { console.error("Failed to analyze risk sentiment:", error); return 0; }
}

async function performFullAnalysis() {
    console.log('Starting scheduled analysis run...');
    try {
        const [riskModifier, eventStreamContent] = await Promise.all([ fetchAndAnalyzeRiskSentiment(), scrapeUrl("https://tradingeconomics.com/ws/stream.ashx?start=0&size=20") ]);
        const fullAnalysisData: any = {};
        for (const currency of CURRENCIES) {
            console.log(`Analyzing ${currency}...`);
            const indicatorScores: any = {};
            for (const indicator of Object.keys(SCORING_RULES)) {
                const sources = SOURCE_CONFIG[currency]?.[indicator] || [];
                if (sources.length === 0) continue;
                console.log(`Analyzing ${currency} - ${indicator}`);
                const scrapedContents = await Promise.all(sources.map(scrapeUrl));
                const combinedContent = scrapedContents.join('\n\n').substring(0, 15000);
                if (!combinedContent.trim()) continue;
                const rules = (SCORING_RULES[indicator] || []).join('\n');
                const prompt = PROMPTS.scoring(indicator, currency, rules, combinedContent);
                try {
                    const result = await callAI(prompt);
                    indicatorScores[indicator] = result;
                } catch (error) { console.error(`Failed to analyze ${currency} - ${indicator}:`, error); }
            }
            
            const pmiScores = [indicatorScores['Manufacturing PMI']?.score, indicatorScores['Services PMI']?.score].filter(s => typeof s === 'number') as number[];
            const pmiAverage = pmiScores.length > 0 ? pmiScores.reduce((a, b) => a + b, 0) / pmiScores.length : 0;
            let otherScoresSum = 0;
            for (const indicator in indicatorScores) {
                if (indicator !== 'Manufacturing PMI' && indicator !== 'Services PMI') { otherScoresSum += indicatorScores[indicator]?.score || 0; }
            }
            const baseScore = Math.round(pmiAverage + otherScoresSum);
            
            fullAnalysisData[currency] = { scores: indicatorScores, baseScore, direction: baseScore > 0 ? 'Bullish' : baseScore < 0 ? 'Bearish' : 'Neutral', riskModifier, eventModifierScore: 0 };
            
            try {
                console.log(`Generating recap for ${currency}`);
                const recapPrompt = PROMPTS.recap(currency, JSON.stringify(indicatorScores), eventStreamContent);
                const recapResult = await callAI(recapPrompt);
                fullAnalysisData[currency].recap = recapResult;
            } catch (error) { console.error(`Failed to generate recap for ${currency}:`, error); }
        }
        console.log('Saving results to database...');
        await connectDB();
        const today = new Date().toISOString().split('T')[0];
        await Analysis.findOneAndUpdate({ date: today }, { data: fullAnalysisData }, { upsert: true, new: true });
        console.log("Analysis run completed successfully.");
    } catch (error) {
        console.error("A critical error occurred during the analysis run:", error);
    }
}

// --- API ENDPOINTS ---
const app = express(); 
app.use(cors({ origin: 'http://localhost:3000' })); 
app.use(express.json());

app.get('/analyze', async (req: express.Request, res: express.Response) => {
    if (process.env.CRON_SECRET && req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('Unauthorized');
    }
    res.status(202).send('Analysis job started.');
    await performFullAnalysis();
});

app.get('/analyze/latest', async (req: express.Request, res: express.Response) => {
    try {
        await connectDB(); const latestAnalysis = await Analysis.findOne().sort({ date: -1 });
        if (!latestAnalysis) { return res.status(404).json({ message: 'No analysis data found.' }); }
        res.status(200).json(latestAnalysis.data);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch latest analysis.', error: (error as Error).message }); }
});

app.get('/analyze/historical', async (req: express.Request, res: express.Response) => {
    try {
        await connectDB(); const historicalData = await Analysis.find().sort({ date: 1 });
        res.status(200).json(historicalData.map(doc => ({ date: doc.date, data: doc.data })));
    } catch (error) { res.status(500).json({ message: 'Failed to fetch historical data.', error: (error as Error).message }); }
});

app.post('/override', async (req: express.Request, res: express.Response) => {
    try {
        const { type, currencyCode, indicator, originalValue, overriddenValue, justification } = req.body;

        if (!type || !currencyCode || originalValue === undefined || overriddenValue === undefined) {
            return res.status(400).json({ message: 'Missing required fields: type, currencyCode, originalValue, overriddenValue.' });
        }
        if (type === 'score' && !indicator) {
            return res.status(400).json({ message: 'Field "indicator" is required for a "score" override.' });
        }
        if (type === 'bias') {
             if (typeof originalValue !== 'string' || typeof overriddenValue !== 'string' || !VALID_BIAS_VALUES.includes(overriddenValue)) {
                return res.status(400).json({ message: 'Values for a "bias" override must be one of: ' + VALID_BIAS_VALUES.join(', ') });
             }
        }
        if (type === 'score' && (typeof originalValue !== 'number' || typeof overriddenValue !== 'number')) {
            return res.status(400).json({ message: 'Values for a "score" override must be numbers.' });
        }

        await connectDB();
        const newOverride = new Override({
            type, currencyCode, indicator, originalValue, overriddenValue, justification,
        });
        await newOverride.save();
        res.status(201).json({ message: 'Override logged successfully.' });
    } catch (error) {
        console.error("Error logging override:", error);
        res.status(500).json({ message: 'Failed to log override.', error: (error as Error).message });
    }
});

export default app;