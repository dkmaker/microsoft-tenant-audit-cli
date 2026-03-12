export interface AuditWarning {
  checkId: string;
  message: string;
  timestamp: Date;
}

export interface AuditError {
  checkId: string;
  error: Error;
  timestamp: Date;
}

export interface ErrorSummary {
  totalWarnings: number;
  totalErrors: number;
  warnings: AuditWarning[];
  errors: AuditError[];
}

export class AuditErrorCollector {
  private warnings: AuditWarning[] = [];
  private errors: AuditError[] = [];

  addWarning(checkId: string, message: string): void {
    this.warnings.push({ checkId, message, timestamp: new Date() });
  }

  addError(checkId: string, error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.errors.push({ checkId, error: err, timestamp: new Date() });
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getSummary(): ErrorSummary {
    return {
      totalWarnings: this.warnings.length,
      totalErrors: this.errors.length,
      warnings: [...this.warnings],
      errors: [...this.errors],
    };
  }

  printSummary(): void {
    const summary = this.getSummary();
    if (summary.totalWarnings === 0 && summary.totalErrors === 0) {
      console.log("\n✅ Audit completed with no warnings or errors.");
      return;
    }

    console.log(`\n⚠️  Audit Summary: ${summary.totalWarnings} warning(s), ${summary.totalErrors} error(s)`);

    if (summary.totalWarnings > 0) {
      console.log("\nWarnings:");
      for (const w of summary.warnings) {
        console.log(`  ⚠ [${w.checkId}] ${w.message}`);
      }
    }

    if (summary.totalErrors > 0) {
      console.log("\nErrors:");
      for (const e of summary.errors) {
        console.log(`  ✗ [${e.checkId}] ${e.error.message}`);
      }
    }
  }
}
