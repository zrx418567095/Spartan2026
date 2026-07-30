// 计算费用合计、待支付、状态（适配大项+分摊模型）
window.SpartanSummary = {

  // 成员个人分摊汇总（接收：splits 数组 + 该成员 id）
  summarizeMemberSplits(splits, memberId) {
    const mine = splits.filter(s => s.memberId === memberId);
    const totalCents = mine.reduce((sum, s) => sum + s.amountCents, 0);
    const paidCents = mine
      .filter(s => s.paidStatus === 'paid')
      .reduce((sum, s) => sum + s.amountCents, 0);
    const partialCents = mine
      .filter(s => s.paidStatus === 'partial')
      .reduce((sum, s) => sum + s.amountCents, 0);
    return {
      totalCents,
      paidCents,
      partialCents,
      pendingCents: totalCents - paidCents,
      items: mine.length
    };
  },

  // 大项汇总（含未分配金额）—— 管理员视图
  summarizeItems(items, splits) {
    return items.map(item => {
      const itemSplits = splits.filter(s => s.itemId === item.id);
      const splitCents = itemSplits.reduce((sum, s) => sum + s.amountCents, 0);
      const paidCents = itemSplits
        .filter(s => s.paidStatus === 'paid')
        .reduce((sum, s) => sum + s.amountCents, 0);
      return {
        ...item,
        splitCents,
        unassignedCents: item.amountCents - splitCents,
        paidCents,
        memberCount: itemSplits.length
      };
    });
  },

  // 团队费用总览
  summarizeTeam(items, splits) {
    const totalCents = items.reduce((sum, it) => sum + it.amountCents, 0);
    const splitCents = splits.reduce((sum, s) => sum + s.amountCents, 0);
    const paidCents = splits
      .filter(s => s.paidStatus === 'paid')
      .reduce((sum, s) => sum + s.amountCents, 0);
    const pendingCents = splitCents - paidCents;
    return {
      itemTotal: totalCents,
      splitTotal: splitCents,
      unassignedTotal: totalCents - splitCents,
      paidCents,
      pendingCents
    };
  },

  // 单条分摊的状态（与原 paid/partial/unpaid 兼容）
  splitStatus(s) {
    if (s.paidStatus === 'paid') return 'paid';
    if (s.paidStatus === 'partial') return 'partial';
    return 'unpaid';
  },

  // 大项整体状态（已结清 / 部分结清 / 待支付）
  itemStatus(item, splits) {
    const itemSplits = splits.filter(s => s.itemId === item.id);
    if (itemSplits.length === 0) return 'unpaid';
    const allPaid = itemSplits.every(s => s.paidStatus === 'paid');
    const anyPaid = itemSplits.some(s => s.paidStatus !== 'unpaid');
    if (allPaid) return 'paid';
    if (anyPaid) return 'partial';
    return 'unpaid';
  },

  statusLabel(status) {
    return ({ paid: '已结清', partial: '部分支付', unpaid: '待支付' })[status] || '待支付';
  },

  gearStatusLabel(status) {
    return ['未确认', '已有', '待购买', '已装包'][status] || '未确认';
  },

  summarizeGear(publicGear, statusMap) {
    const total = publicGear.length;
    const ready = publicGear.filter(item => {
      const status = statusMap && statusMap[item.name];
      return status === 1 || status === 3;
    }).length;
    return { total, ready, rate: total ? Math.round((ready / total) * 100) : 0 };
  },

  // 元转元（cents -> ¥）
  formatCents(cents) {
    return `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
};