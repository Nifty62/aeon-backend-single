import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose, { Schema, Document, Model } from 'mongoose';
import puppeteer from 'puppeteer';
import { GoogleGenAI } from "@google/genai";

// --- 1. STATE & CONFIGURATION ---

// In-memory state for tracking the analysis job.
// In a larger application, this would be stored in a database or Redis.
const analysisState = {
    isRunning: false,
    progressMessage: 'Idle',
    startTime: 0,
};

// Environment Variable Check
const { MONGODB_URI, API_KEY } = process.env;
if (!MONGODB_URI || !API_KEY) {
    throw new Error("Missing MONGODB_URI or API_KEY in environment variables.");
}

// AI Client Initialization
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- COMPLETE STATIC CONFIGURATION (Ported from frontend files) ---
const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "NZD", "CAD", "JPY", "CHF"];
const INDICATORS = [
    "Manufacturing PMI", "Services PMI", "Consumer Confidence", "CPI", "Money Supply",
    "COT", "Central Bank", "Seasonality", "Retail Sentiment", "Strong vs Weak"
];

const SOURCE_CONFIG: { [currency: string]: { [indicator: string]: string[] } } = {
    "USD": {
        "Manufacturing PMI": ["https://tradingeconomics.com/united-states/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/united-states/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/united-states/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/united-states/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/united-states/money-supply-m2"],
        "Central Bank": ["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=EURUSD"]
    },
    "EUR": {
        "Manufacturing PMI": ["https://tradingeconomics.com/euro-area/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/euro-area/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/euro-area/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/euro-area/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/euro-area/money-supply-m2"],
        "Central Bank": ["https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=EURUSD"]
    },
    "GBP": {
        "Manufacturing PMI": ["https://tradingeconomics.com/united-kingdom/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/united-kingdom/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/united-kingdom/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/united-kingdom/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/united-kingdom/money-supply-m2"],
        "Central Bank": ["https://www.bankofengland.co.uk/monetary-policy-report-and-interim-reports"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=GBPUSD"]
    },
    "AUD": {
        "Manufacturing PMI": ["https://tradingeconomics.com/australia/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/australia/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/australia/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/australia/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/australia/money-supply-m3"],
        "Central Bank": ["https://www.rba.gov.au/media-releases/"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=AUDUSD"]
    },
    "NZD": {
        "Manufacturing PMI": ["https://tradingeconomics.com/new-zealand/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/new-zealand/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/new-zealand/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/new-zealand/inflation-cpi"],
        "Money Supply": ["https://tradingeconomics.com/new-zealand/money-supply-m3"],
        "Central Bank": ["https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=NZDUSD"]
    },
    "CAD": {
        "Manufacturing PMI": ["https://tradingeconomics.com/canada/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/canada/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/canada/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/canada/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/canada/money-supply-m2"],
        "Central Bank": ["https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDCAD"]
    },
    "JPY": {
        "Manufacturing PMI": ["https://tradingeconomics.com/japan/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/japan/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/japan/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/japan/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/japan/money-supply-m2"],
        "Central Bank": ["https://www.boj.or.jp/en/mopo/mpmdeci/index.htm"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDJPY"]
    },
    "CHF": {
        "Manufacturing PMI": ["https://tradingeconomics.com/switzerland/manufacturing-pmi"],
        "Services PMI": ["https://tradingeconomics.com/switzerland/services-pmi"],
        "Consumer Confidence": ["https://tradingeconomics.com/switzerland/consumer-confidence"],
        "CPI": ["https://tradingeconomics.com/switzerland/consumer-price-index-cpi"],
        "Money Supply": ["https://tradingeconomics.com/switzerland/money-supply-m2"],
        "Central Bank": ["https://www.snb.ch/en/i-publications/snb-news/monetary-policy-assessments"],
        "Seasonality": ["https://market-bulls.com/seasonal-tendency-market-charts/"],
        "COT": ["https://market-bulls.com/cot-report/"],
        "Retail Sentiment": ["https://fxssi.com/tools/current-ratio?filter=USDCHF"]
    }
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
    recap: (currency: string, indicatorData: string) => `Analyze the scored data for ${currency}: ${indicatorData}. Provide an economic recap. Respond ONLY with a valid JSON object: {"bias": "<string>", "narrativeReasoning": "<string>", "eventModifiers": [{"heading": "<string>", "flag": "<'Green Flag'|'Yellow Flag'|'Red Flag'>", "description": "<string>"}]}`,
};

// --- 2. DATABASE SETUP ---

mongoose.set('strictQuery', true);

const ScoreSchema = new Schema({ score: { type: Number, required: true }, rationale: { type: String, required: true } }, { _id: false });
const EventModifierSchema = new Schema({ heading: String, flag: String, description: String }, { _id: false });
const EconomicRecapSchema = new Schema({ bias: String, narrativeReasoning: String, eventModifiers: [EventModifierSchema] }, { _id: false });
const CurrencyAnalysisSchema = new Schema({ scores: { type: Map, of: ScoreSchema }, sigmaScore: Number, direction: String, recap: EconomicRecapSchema }, { _id: false });
interface IAnalysis extends Document { date: string; data: Map<string, any>; }
const AnalysisSchema = new Schema<IAnalysis>({ date: { type: String, required: true, unique: true, index: true }, data: { type: Map, of: CurrencyAnalysisSchema } });
const Analysis: Model<IAnalysis> = mongoose.models.Analysis || mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
    }
};

// --- 3. CORE LOGIC ---

const cleanHtml = (html: string): string => html.replace(/<style[^>]*>.*<\/style>/gs, '').replace(/<script[^>]*>.*<\/script>/gs, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function scrapeUrl(url: string): Promise<string> {
    let browser;
    try {
        analysisState.progressMessage = `Scraping: ${new URL(url).hostname}`;
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        const content = await page.content();
        await browser.close();
        return cleanHtml(content);
    } catch (error) {
        if (browser) await browser.close();
        console.error(`Failed to scrape ${url}:`, error);
        return '';
    }
}

async function callAI(prompt: string): Promise<any> {
    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        const cleanedText = response.text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("AI call failed:", error);
        throw new Error("Failed to get a valid JSON response from AI.");
    }
}

async function performFullAnalysis(currenciesToAnalyze: string[]) {
    try {
        const fullAnalysisData: any = {};

        for (const currency of currenciesToAnalyze) {
            analysisState.progressMessage = `Analyzing ${currency}...`;
            const indicatorScores: any = {};
            let sigmaScore = 0;
            let validScoresCount = 0;

            for (const indicator of INDICATORS) {
                const sources = SOURCE_CONFIG[currency]?.[indicator] || [];
                if (sources.length === 0) continue;

                analysisState.progressMessage = `Analyzing ${currency} - ${indicator}`;
                const scrapedContents = await Promise.all(sources.map(scrapeUrl));
                const combinedContent = scrapedContents.join('\n\n').substring(0, 15000);

                if (!combinedContent.trim()) continue;

                const rules = (SCORING_RULES[indicator] || []).join('\n');
                const prompt = PROMPTS.scoring(indicator, currency, rules, combinedContent);
                
                try {
                    const result = await callAI(prompt);
                    indicatorScores[indicator] = result;
                    sigmaScore += result.score;
                    validScoresCount++;
                } catch (error) {
                    console.error(`Failed to analyze ${currency} - ${indicator}:`, error);
                }
            }
            
            const averageScore = validScoresCount > 0 ? sigmaScore / validScoresCount : 0;
            fullAnalysisData[currency] = {
                scores: indicatorScores,
                sigmaScore: averageScore,
                direction: averageScore > 0.5 ? 'Bullish' : averageScore < -0.5 ? 'Bearish' : 'Neutral',
            };

            try {
                analysisState.progressMessage = `Generating recap for ${currency}`;
                const recapPrompt = PROMPTS.recap(currency, JSON.stringify(indicatorScores));
                const recapResult = await callAI(recapPrompt);
                fullAnalysisData[currency].recap = recapResult;
            } catch (error) {
                 console.error(`Failed to generate recap for ${currency}:`, error);
            }
        }

        analysisState.progressMessage = 'Saving results to database...';
        await connectDB();
        const today = new Date().toISOString().split('T')[0];
        await Analysis.findOneAndUpdate({ date: today }, { data: fullAnalysisData }, { upsert: true, new: true });
        
        console.log("Analysis run completed successfully.");

    } catch (error) {
        console.error("A critical error occurred during the analysis run:", error);
    } finally {
        analysisState.isRunning = false;
        analysisState.progressMessage = 'Idle';
    }
}

// --- 4. API ENDPOINTS ---

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/analyze', (req: Request, res: Response) => {
    if (analysisState.isRunning) {
        return res.status(409).json({ message: 'An analysis is already in progress.', startTime: analysisState.startTime });
    }

    const currenciesToRun = req.body.currencies || CURRENCIES;
    analysisState.isRunning = true;
    analysisState.startTime = Date.now();
    analysisState.progressMessage = 'Starting analysis...';

    // Immediately respond to the client
    res.status(202).json({ message: 'Analysis started.', currencies: currenciesToRun });

    // Start the long-running job without awaiting it
    performFullAnalysis(currenciesToRun);
});

app.get('/api/analyze/status', (req: Request, res: Response) => {
    res.status(200).json({
        isRunning: analysisState.isRunning,
        progressMessage: analysisState.progressMessage,
        elapsedTime: analysisState.isRunning ? Math.round((Date.now() - analysisState.startTime) / 1000) : 0,
    });
});

app.get('/api/analyze/latest', async (req: Request, res: Response) => {
    try {
        await connectDB();
        const latestAnalysis = await Analysis.findOne().sort({ date: -1 });
        if (!latestAnalysis) {
            return res.status(404).json({ message: 'No analysis data found.' });
        }
        res.status(200).json(latestAnalysis.data);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch latest analysis.', error: (error as Error).message });
    }
});

app.get('/api/analyze/historical', async (req: Request, res: Response) => {
    try {
        await connectDB();
        const historicalData = await Analysis.find().sort({ date: 1 });
        const formattedData = historicalData.map(doc => ({ date: doc.date, data: doc.data }));
        res.status(200).json(formattedData);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch historical data.', error: (error as Error).message });
    }
});

// Export the Express app for Vercel's serverless environment
export default app;