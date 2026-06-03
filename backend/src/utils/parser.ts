import { ParsedEntry, Config } from '../types';
import { DEFAULT_CONFIG } from './auth';

export class TextParser {
  private config: Config;

  constructor(config?: Config) {
    this.config = config || DEFAULT_CONFIG;
  }

  setConfig(config: Config) {
    this.config = config;
  }

  private extractDate(text: string): [string | null, string] {
    const datePattern = /(\d{8})/;
    const match = text.match(datePattern);
    if (match) {
      const dateStr = match[1];
      try {
        new Date(dateStr.substring(0, 4), parseInt(dateStr.substring(4, 6), 10) - 1, parseInt(dateStr.substring(6, 8), 10));
        return [dateStr, text.replace(dateStr, '', 1).trim()];
      } catch {
        return [null, text];
      }
    }
    return [null, text];
  }

  private extractAmount(text: string): [number | null, string] {
    const patterns = [
      /(\d+)(?:元)?$/,
      /(\d+)(?=[^\d]*(?:元|$))/,
      /(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const amount = parseInt(match[1], 10);
          if (amount > 0) {
            return [amount, text];
          }
        } catch {
          continue;
        }
      }
    }
    return [null, text];
  }

  private extractPerson(text: string): [string, number] {
    const { preset_names, excluded_keywords } = this.config;
    
    for (const name of [...preset_names].sort((a, b) => b.length - a.length)) {
      if (text.startsWith(name)) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.6 : 0.9;
        return [name, confidence];
      }
    }

    const keywords = [...this.config.lend_keywords, ...this.config.receive_keywords, ...excluded_keywords];
    const keywordPattern = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`^([\\u4e00-\\u9fa5\\d]+?)(?=${keywordPattern}|元|$)`);
    
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name && name.length <= 6) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.4 : 0.7;
        return [name, confidence];
      }
    }

    const simpleMatch = text.match(/^([\u4e00-\u9fa5\d]{1,6})/);
    if (simpleMatch) {
      const name = simpleMatch[1].trim();
      if (name) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.3 : 0.5;
        return [name, confidence];
      }
    }

    return ['其他', 0.2];
  }

  private determineType(text: string): [string, number] {
    const { lend_keywords, receive_keywords } = this.config;

    const lendCount = lend_keywords.filter(kw => text.includes(kw)).length;
    const receiveCount = receive_keywords.filter(kw => text.includes(kw)).length;

    if (text.includes('少回') || text.includes('说明还')) {
      return ['借出', 0.9];
    }

    if (receiveCount > lendCount) {
      if (text.includes('还') && text.includes('借')) {
        if (text.indexOf('还') < text.indexOf('借')) {
          return ['收回', 0.9];
        } else {
          return ['借出', 0.8];
        }
      }
      return ['收回', Math.min(0.9, 0.7 + receiveCount * 0.1)];
    } else if (lendCount > 0) {
      return ['借出', Math.min(0.9, 0.7 + lendCount * 0.1)];
    } else if (receiveCount > 0) {
      return ['收回', Math.min(0.9, 0.7 + receiveCount * 0.1)];
    }

    return ['借出', 0.5];
  }

  parseLine(line: string): ParsedEntry | null {
    line = line.trim();
    if (!line) {
      return null;
    }

    const result: ParsedEntry = {
      date: '',
      person: '',
      description: line,
      amount: 0,
      type: '借出',
      confidence: 0.0,
      confidence_details: {
        date: 0,
        amount: 0,
        person: 0,
        type: 0,
      },
    };

    let remaining = line;

    const [date, afterDate] = this.extractDate(line);
    if (date) {
      result.date = date;
      result.confidence_details.date = 1.0;
      remaining = afterDate;
    } else {
      result.date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      result.confidence_details.date = 0.3;
    }

    const [amount, _] = this.extractAmount(remaining);
    if (!amount) {
      return null;
    }
    result.amount = amount;
    result.confidence_details.amount = 1.0;

    const [person, personConfidence] = this.extractPerson(remaining);
    result.person = person;
    result.confidence_details.person = personConfidence;

    const [entryType, typeConfidence] = this.determineType(remaining);
    result.type = entryType as '借出' | '收回';
    result.confidence_details.type = typeConfidence;

    const weights = { date: 0.2, amount: 0.3, person: 0.3, type: 0.2 };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weightedSum = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (result.confidence_details[key as keyof typeof result.confidence_details] * weight);
    }, 0);
    result.confidence = weightedSum / totalWeight;

    return result;
  }

  parse(text: string): ParsedEntry[] {
    const lines = text.trim().split('\n');
    const results: ParsedEntry[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      const parsed = this.parseLine(trimmedLine);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  }

  parseWithAlert(text: string, threshold?: number) {
    const effectiveThreshold = threshold ?? this.config.confidence_threshold;
    const results = this.parse(text);

    const highConfidence = results.filter(r => r.confidence >= effectiveThreshold);
    const lowConfidence = results.filter(r => r.confidence < effectiveThreshold);

    return {
      high_confidence: highConfidence,
      low_confidence: lowConfidence,
      threshold: effectiveThreshold,
    };
  }
}