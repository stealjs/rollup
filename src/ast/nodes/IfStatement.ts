import { UNKNOWN_VALUE } from '../values';
import { ExpressionNode, StatementBase, StatementNode } from './shared/Node';
import MagicString from 'magic-string';
import { NodeType } from './NodeType';
import { RenderOptions } from '../../utils/renderHelpers';
import ExecutionPathOptions from '../ExecutionPathOptions';

export default class IfStatement extends StatementBase {
	type: NodeType.IfStatement;
	test: ExpressionNode;
	consequent: StatementNode;
	alternate: StatementNode | null;

	private hasUnknownTestValue: boolean;

	hasEffects(options: ExecutionPathOptions): boolean {
		return (
			this.test.hasEffects(options) ||
			(this.hasUnknownTestValue
				? this.consequent.hasEffects(options) ||
				  (this.alternate !== null && this.alternate.hasEffects(options))
				: this.someRelevantBranch(node => node.hasEffects(options)))
		);
	}

	include() {
		this.included = true;
		const testValue = this.test.getValue();
		if (testValue === UNKNOWN_VALUE || this.test.shouldBeIncluded()) {
			this.test.include();
		}
		if (testValue === UNKNOWN_VALUE) {
			this.consequent.include();
			if (this.alternate !== null) this.alternate.include();
		} else if (testValue) {
			this.consequent.include();
		} else if (this.alternate !== null) {
			this.alternate.include();
		}
	}

	initialise() {
		this.included = false;
		this.hasUnknownTestValue = false;
	}

	render(code: MagicString, options: RenderOptions) {
		const testValue = this.test.getValue();
		if (
			!this.context.treeshake ||
			this.test.included ||
			(testValue ? this.alternate !== null && this.alternate.included : this.consequent.included)
		) {
			super.render(code, options);
		} else {
			// if test is not included, it is impossible that alternate===null even though it is the retained branch
			const branchToRetain = testValue ? this.consequent : this.alternate;
			code.remove(this.start, branchToRetain.start);
			code.remove(branchToRetain.end, this.end);
			branchToRetain.render(code, options);
		}
	}

	private someRelevantBranch(predicateFunction: (node: StatementNode) => boolean): boolean {
		const testValue = this.test.getValue();
		if (testValue === UNKNOWN_VALUE) {
			this.hasUnknownTestValue = true;
			return (
				predicateFunction(this.consequent) ||
				(this.alternate !== null && predicateFunction(this.alternate))
			);
		}
		return testValue
			? predicateFunction(this.consequent)
			: this.alternate !== null && predicateFunction(this.alternate);
	}
}
