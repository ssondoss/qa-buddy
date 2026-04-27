import { Injectable } from '@angular/core';
import type {
  WorkflowLocator,
  WorkflowStep,
} from '../models/workflow-step.model';

interface ScriptStatement {
  readonly lineNumber: number;
  readonly trimmed: string;
}

@Injectable({ providedIn: 'root' })
export class RecordWorkflowParserService {
  parse(script: string | null): WorkflowStep[] {
    if (!script?.trim()) {
      return [];
    }

    const statements = script
      .split('\n')
      .map((raw, index) => ({
        lineNumber: index + 1,
        trimmed: raw.trim(),
      }))
      .filter(({ trimmed }) => this.isWorkflowStatement(trimmed));

    return statements.map((statement, index) => this.parseStatement(statement, index + 1));
  }

  private isWorkflowStatement(statement: string): boolean {
    if (!statement) {
      return false;
    }

    return !(
      statement.startsWith('import ') ||
      statement.startsWith('test(') ||
      statement === '});' ||
      statement === '}'
    );
  }

  private parseStatement(statement: ScriptStatement, order: number): WorkflowStep {
    return (
      this.parseGoto(statement, order) ??
      this.parseLocatorAction(statement, order) ??
      this.parseExpectation(statement, order) ??
      this.parseWait(statement, order) ??
      this.parseFallback(statement, order)
    );
  }

  private parseGoto(statement: ScriptStatement, order: number): WorkflowStep | null {
    const match = statement.trimmed.match(/^await\s+page\.goto\((['"`])(.+?)\1\);?$/);
    if (!match) {
      return null;
    }

    const url = match[2];
    const hostname = this.describeUrl(url);

    return this.createStep(order, statement, {
      kind: 'navigate',
      title: `Open ${hostname}`,
      detail: `Navigate the browser to ${url}.`,
      locator: { strategy: 'url', value: url },
      capabilities: ['screenshots', 'apiChecks'],
    });
  }

  private parseLocatorAction(statement: ScriptStatement, order: number): WorkflowStep | null {
    const match = statement.trimmed.match(/^await\s+(page\..+)\.(click|fill|hover|press|check|uncheck)\((.*)\);?$/);
    if (!match) {
      return null;
    }

    const locator = this.parseLocator(match[1]);
    const action = match[2];
    const rawArgs = match[3].trim();

    if (!locator) {
      return null;
    }

    const locatorLabel = this.describeLocator(locator);
    const value = this.readQuotedValue(rawArgs);

    switch (action) {
      case 'click':
        return this.createStep(order, statement, {
          kind: 'click',
          title: `Click ${locatorLabel}`,
          detail: `Trigger a click on ${this.describeLocator(locator, true)}.`,
          locator,
          capabilities: ['screenshots', 'apiChecks'],
        });
      case 'fill':
        return this.createStep(order, statement, {
          kind: 'input',
          title: `Enter ${value ? `"${value}"` : 'text'} in ${locatorLabel}`,
          detail: value
            ? `Fill ${this.describeLocator(locator, true)} with "${value}".`
            : `Fill ${this.describeLocator(locator, true)} with a value.`,
          locator,
          capabilities: ['payloads', 'screenshots'],
        });
      case 'press':
        return this.createStep(order, statement, {
          kind: 'input',
          title: `Press ${value ? `"${value}"` : 'a key'} on ${locatorLabel}`,
          detail: value
            ? `Send the ${value} key while focused on ${this.describeLocator(locator, true)}.`
            : `Send a keyboard action while focused on ${this.describeLocator(locator, true)}.`,
          locator,
          capabilities: ['payloads', 'screenshots'],
        });
      case 'hover':
        return this.createStep(order, statement, {
          kind: 'click',
          title: `Hover over ${locatorLabel}`,
          detail: `Move the pointer over ${this.describeLocator(locator, true)}.`,
          locator,
          capabilities: ['screenshots'],
        });
      case 'check':
        return this.createStep(order, statement, {
          kind: 'input',
          title: `Enable ${locatorLabel}`,
          detail: `Check ${this.describeLocator(locator, true)}.`,
          locator,
          capabilities: ['payloads', 'screenshots'],
        });
      case 'uncheck':
        return this.createStep(order, statement, {
          kind: 'input',
          title: `Disable ${locatorLabel}`,
          detail: `Uncheck ${this.describeLocator(locator, true)}.`,
          locator,
          capabilities: ['payloads', 'screenshots'],
        });
      default:
        return null;
    }
  }

  private parseExpectation(statement: ScriptStatement, order: number): WorkflowStep | null {
    const match = statement.trimmed.match(/^await\s+expect\((.+)\)\.(.+);?$/);
    if (!match) {
      return null;
    }

    return this.createStep(order, statement, {
      kind: 'assert',
      title: 'Validate recorded expectation',
      detail: `Assert the expected UI outcome defined by ${match[2].replace(/\(\)$/, '')}.`,
      capabilities: ['screenshots', 'apiChecks'],
    });
  }

  private parseWait(statement: ScriptStatement, order: number): WorkflowStep | null {
    const match = statement.trimmed.match(/^await\s+page\.(waitFor.+)\((.*)\);?$/);
    if (!match) {
      return null;
    }

    return this.createStep(order, statement, {
      kind: 'wait',
      title: `Wait for ${this.humanizeIdentifier(match[1])}`,
      detail: 'Synchronize the workflow before continuing to the next action.',
      capabilities: ['screenshots'],
    });
  }

  private parseFallback(statement: ScriptStatement, order: number): WorkflowStep {
    return this.createStep(order, statement, {
      kind: 'code',
      title: 'Keep custom Playwright code',
      detail: 'This statement stays available as a raw code step until we model it explicitly.',
      capabilities: ['screenshots'],
    });
  }

  private createStep(
    order: number,
    statement: ScriptStatement,
    overrides: Omit<WorkflowStep, 'id' | 'order' | 'sourceLine' | 'code'>,
  ): WorkflowStep {
    return {
      id: `workflow-step-${order}-${statement.lineNumber}`,
      order,
      sourceLine: statement.lineNumber,
      code: statement.trimmed,
      ...overrides,
    };
  }

  private parseLocator(expression: string): WorkflowLocator | undefined {
    const testIdMatch = expression.match(/\.getByTestId\((['"`])(.+?)\1\)/);
    if (testIdMatch) {
      return { strategy: 'testId', value: testIdMatch[2] };
    }

    const textMatch = expression.match(/\.getByText\((['"`])(.+?)\1\)/);
    if (textMatch) {
      return { strategy: 'text', value: textMatch[2] };
    }

    const roleMatch = expression.match(/\.getByRole\((['"`])(.+?)\1(?:,\s*\{[^}]*name:\s*(['"`])(.+?)\3[^}]*\})?\)/);
    if (roleMatch) {
      return { strategy: 'role', value: roleMatch[4] ?? roleMatch[2] };
    }

    const locatorMatch = expression.match(/\.locator\((['"`])(.+?)\1\)/);
    if (locatorMatch) {
      return { strategy: 'locator', value: locatorMatch[2] };
    }

    return undefined;
  }

  private describeUrl(rawUrl: string): string {
    try {
      const url = new URL(rawUrl);
      return url.pathname === '/' ? url.hostname : `${url.hostname}${url.pathname}`;
    } catch {
      return rawUrl;
    }
  }

  private describeLocator(locator: WorkflowLocator, sentence = false): string {
    const label = this.humanizeLocatorValue(locator);

    switch (locator.strategy) {
      case 'testId':
        return sentence ? `the test id ${label}` : label;
      case 'text':
        return sentence ? `the text "${locator.value}"` : label;
      case 'role':
        return sentence ? `the ${label}` : label;
      case 'locator':
        return sentence ? `the locator ${locator.value}` : label;
      case 'url':
        return sentence ? `the page ${locator.value}` : label;
    }
  }

  private humanizeLocatorValue(locator: WorkflowLocator): string {
    if (locator.strategy !== 'testId') {
      return locator.value;
    }

    const replacements: Record<string, string> = {
      btn: 'button',
      txt: 'text field',
      inp: 'input',
      lnk: 'link',
      nav: 'navigation',
      hdr: 'header',
    };

    return locator.value
      .split(/[-_]/)
      .map((part) => replacements[part] ?? part)
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private readQuotedValue(rawArgs: string): string | null {
    const match = rawArgs.match(/(['"`])(.+?)\1/);
    return match ? match[2] : null;
  }

  private humanizeIdentifier(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }
}
