import type { TagCondition } from '@modules/tags/TagCondition';
import { HasTagCondition } from '@modules/tags/HasTagCondition';
import { NotTagCondition } from '@modules/tags/NotTagCondition';
import { AndTagCondition } from '@modules/tags/AndTagCondition';
import { OrTagCondition } from '@modules/tags/OrTagCondition';

const TOKEN_RE = /\(|\)|[^\s()]+/g;

interface ParseContext {
  readonly expression: string;
  readonly tokens: ReadonlyArray<string>;
  position: number;
}

/**
 * Parses boolean tag expressions like `"emphasis or (hook and not
 * cta)"` into a `TagCondition` tree. Keywords `and` / `or` / `not`
 * are case-insensitive; every other token is a tag name. Precedence
 * is `not` over `and` over `or`; parentheses group. Throws on an
 * empty or malformed expression — callers surface that at load time,
 * where the expression is authored. Stateless: every call builds its
 * own context, so one instance is safe to share across callers.
 */
export class TagConditionParser {

  parse(expression: string): TagCondition {
    const tokens = expression.match(TOKEN_RE) ?? [];
    if (tokens.length === 0) throw new Error('Tag condition is empty.');
    const ctx: ParseContext = { expression, tokens, position: 0 };
    const condition = this.parseOr(ctx);
    if (ctx.position < ctx.tokens.length) {
      throw new Error(`Invalid tag condition "${ctx.expression}": unexpected "${ctx.tokens[ctx.position]}".`);
    }
    return condition;
  }

  private parseOr(ctx: ParseContext): TagCondition {
    const operands = [this.parseAnd(ctx)];
    while (this.matchKeyword(ctx, 'or')) operands.push(this.parseAnd(ctx));
    return operands.length === 1 ? operands[0]! : new OrTagCondition(...operands);
  }

  private parseAnd(ctx: ParseContext): TagCondition {
    const operands = [this.parseNot(ctx)];
    while (this.matchKeyword(ctx, 'and')) operands.push(this.parseNot(ctx));
    return operands.length === 1 ? operands[0]! : new AndTagCondition(...operands);
  }

  private parseNot(ctx: ParseContext): TagCondition {
    if (this.matchKeyword(ctx, 'not')) return new NotTagCondition(this.parseNot(ctx));
    return this.parsePrimary(ctx);
  }

  private parsePrimary(ctx: ParseContext): TagCondition {
    if (this.match(ctx, '(')) {
      const inner = this.parseOr(ctx);
      if (!this.match(ctx, ')')) throw new Error(`Invalid tag condition "${ctx.expression}": missing ")".`);
      return inner;
    }
    const token = ctx.tokens[ctx.position];
    if (token === undefined || token === ')' || this.isKeyword(token)) {
      throw new Error(`Invalid tag condition "${ctx.expression}": expected a tag name${token === undefined ? '' : `, got "${token}"`}.`);
    }
    ctx.position++;
    return new HasTagCondition(token);
  }

  private match(ctx: ParseContext, token: string): boolean {
    if (ctx.tokens[ctx.position] !== token) return false;
    ctx.position++;
    return true;
  }

  private matchKeyword(ctx: ParseContext, keyword: string): boolean {
    if (ctx.tokens[ctx.position]?.toLowerCase() !== keyword) return false;
    ctx.position++;
    return true;
  }

  private isKeyword(token: string): boolean {
    const lower = token.toLowerCase();
    return lower === 'and' || lower === 'or' || lower === 'not';
  }
}
