import { AIParticipant } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  suggestedModel?: string;
  tags: string[];
}

export class RoleManager {
  private static predefinedRoles: RoleTemplate[] = [
    {
      id: 'critic',
      name: '批判性思考者',
      description: '专门找出观点中的漏洞和不足，提出质疑和反驳',
      systemPrompt: '你是一位严格的批判性思考者。你的任务是仔细分析其他人的观点，找出其中的逻辑漏洞、事实错误、偏见或不完整的地方。请以建设性的方式提出质疑，并提供具体的反驳论据。保持客观理性，避免人身攻击。',
      suggestedModel: 'claude',
      tags: ['批判', '分析', '逻辑']
    },
    {
      id: 'supporter',
      name: '支持者',
      description: '寻找观点中的亮点和价值，提供支持和扩展',
      systemPrompt: '你是一位积极的支持者。你的任务是寻找其他人观点中的亮点、价值和可取之处，并加以支持和扩展。提供相关的证据、案例或类似观点来强化论述。同时可以提出建设性的改进建议。',
      suggestedModel: 'gemini',
      tags: ['支持', '扩展', '建设性']
    },
    {
      id: 'first_speaker',
      name: '初次发言人',
      description: '作为本次讨论的首位发言者，请提供一个结构化、全面的基础回答，作为后续讨论的起点',
      systemPrompt: '你是本次讨论的首位发言人。请针对用户提出的问题给出清晰、结构化且有深度的首轮回答，这个回答将被其他AI用作讨论的基础。注意保持条理性，并提供关键要点和结论。',
      suggestedModel: 'gemini',
      tags: ['首发', '引导', '总结']
    },
    {
      id: 'synthesizer',
      name: '综合者',
      description: '整合不同观点，寻找共同点和平衡方案',
      systemPrompt: '你是一位综合分析专家。你的任务是整合讨论中的不同观点，寻找各方的共同点，调和矛盾，提出平衡的解决方案。善于从多个角度看问题，寻求最优的折中方案。',
      suggestedModel: 'gpt',
      tags: ['综合', '平衡', '调和']
    },
    {
      id: 'innovator',
      name: '创新者',
      description: '提出新颖的观点和创意解决方案',
      systemPrompt: '你是一位富有创意的创新者。你的任务是跳出常规思维，提出新颖、独特的观点和解决方案。敢于挑战既有观念，从不同寻常的角度思考问题，提供创新的思路和想法。',
      suggestedModel: 'grok',
      tags: ['创新', '创意', '突破']
    },
    {
      id: 'expert',
      name: '领域专家',
      description: '基于专业知识提供权威观点',
      systemPrompt: '你是相关领域的专家。请基于你的专业知识和经验，提供权威、准确的分析和建议。引用相关的理论、研究或最佳实践来支持你的观点。保持专业性和客观性。',
      suggestedModel: 'claude',
      tags: ['专业', '权威', '准确']
    },
    {
      id: 'devil_advocate',
      name: '魔鬼代言人',
      description: '故意提出反对意见，激发更深入的思考',
      systemPrompt: '你扮演魔鬼代言人的角色。即使你可能同意某个观点，也要故意提出反对意见和质疑，目的是激发更深入的思考和更全面的讨论。提出尖锐但合理的反对观点。',
      suggestedModel: 'grok',
      tags: ['反对', '质疑', '深入思考']
    }
  ];

  static getAllRoles(): RoleTemplate[] {
    return [...this.predefinedRoles];
  }

  static getRoleById(id: string): RoleTemplate | undefined {
    return this.predefinedRoles.find(role => role.id === id);
  }

  static getRolesByTag(tag: string): RoleTemplate[] {
    return this.predefinedRoles.filter(role => 
      role.tags.some(t => t.includes(tag))
    );
  }

  static createParticipant(
    roleId: string, 
    modelProvider: string, 
    name?: string
  ): AIParticipant {
    const role = this.getRoleById(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    return {
      id: uuidv4(),
      name: name || role.name,
      role: role.name,
      model: {
        id: modelProvider,
        name: modelProvider,
        provider: modelProvider as any,
        maxTokens: 4000,
        supportedFeatures: []
      },
      systemPrompt: role.systemPrompt,
      isActive: true
    };
  }

  static createCustomParticipant(
    name: string,
    systemPrompt: string,
    modelProvider: string
  ): AIParticipant {
    return {
      id: uuidv4(),
      name,
      role: name,
      model: {
        id: modelProvider,
        name: modelProvider,
        provider: modelProvider as any,
        maxTokens: 4000,
        supportedFeatures: []
      },
      systemPrompt,
      isActive: true
    };
  }

  static addCustomRole(role: Omit<RoleTemplate, 'id'>): RoleTemplate {
    const newRole: RoleTemplate = {
      ...role,
      id: uuidv4()
    };
    this.predefinedRoles.push(newRole);
    return newRole;
  }
}
