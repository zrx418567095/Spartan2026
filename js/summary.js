// 计算费用合计、待支付、状态
window.SpartanSummary = {
  summarizeExpenses(expenses) {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const paid = expenses.reduce((sum, expense) => sum + expense.paid, 0);
    return { total, paid, pending: total - paid };
  },
  expenseStatus(expense) {
    if (expense.paid >= expense.amount) return 'paid';
    if (expense.paid > 0) return 'partial';
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
  }
};
