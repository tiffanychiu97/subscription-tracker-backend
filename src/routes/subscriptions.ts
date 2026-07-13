import { Router } from 'express';
import db from '../db';
import { randomUUID } from 'crypto';

const router = Router();

function validateSubscription(body: any): string | null {
  const { name, cost, billingCycle, category, nextRenewalDate, startDate } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Name is required';
  }
  if (typeof cost !== 'number' || cost <= 0) {
    return 'Cost must be a positive number';
  }
  if (!['weekly', 'monthly', 'yearly'].includes(billingCycle)) {
    return 'Invalid billing cycle';
  }
  if (!category || typeof category !== 'string') {
    return 'Category is required';
  }
  if (!nextRenewalDate || !startDate) {
    return 'Renewal date and start date are required';
  }
  if (nextRenewalDate < startDate) {
    return 'Renewal date cannot be before start date';
  }
  return null; // no errors
}

// GET stats — must be defined BEFORE router.get('/:id', ...) if you add that later
router.get('/stats', (req, res) => {

  const subs = db.prepare('SELECT * FROM subscriptions').all() as any[];

  // normalize any billing cycle to a monthly cost
  const toMonthly = (cost: number, cycle: string) => {
    if (cycle === 'yearly') return cost / 12;
    if (cycle === 'weekly') return cost * 4.33;
    return cost; // monthly
  };

  const totalMonthlySpend = subs.reduce((sum, s) => sum + toMonthly(s.cost, s.billing_cycle), 0);
  const totalYearlySpend = totalMonthlySpend * 12;

  // group by category
  const byCategory: Record<string, number> = {};
  subs.forEach(s => {
    const monthly = toMonthly(s.cost, s.billing_cycle);
    byCategory[s.category] = (byCategory[s.category] || 0) + monthly;
  });
  const spendByCategory = Object.entries(byCategory).map(([category, total]) => ({
    category,
    total: Math.round(total * 100) / 100
  }));

  // upcoming renewals in next 30 days
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = subs
    .filter(s => {
      const renewal = new Date(s.next_renewal_date);
      return renewal >= now && renewal <= in30Days;
    })
    .sort((a, b) => new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime());

  // potential savings from rarely-used subs
  const potentialSavings = subs
    .filter(s => s.is_rarely_used)
    .reduce((sum, s) => sum + toMonthly(s.cost, s.billing_cycle), 0);

  res.json({
    totalMonthlySpend: Math.round(totalMonthlySpend * 100) / 100,
    totalYearlySpend: Math.round(totalYearlySpend * 100) / 100,
    spendByCategory,
    upcomingRenewals,
    potentialSavings: Math.round(potentialSavings * 100) / 100
  });
});

// GET all
router.get('/', (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions').all();
  res.json(subs);
});

// POST create
router.post('/', (req, res) => {
  const validationError = validateSubscription(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { name, cost, billingCycle, category, nextRenewalDate, startDate, isRarelyUsed } = req.body;
  const id = randomUUID();
  
  db.prepare(`
    INSERT INTO subscriptions (id, name, cost, billing_cycle, category, next_renewal_date, start_date, is_rarely_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, cost, billingCycle, category, nextRenewalDate, startDate, isRarelyUsed ? 1 : 0);
  res.status(201).json({ id, ...req.body });
});

//PUT
router.put('/:id', (req, res) => {
  const validationError = validateSubscription(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { id } = req.params;
  const { name, cost, billingCycle, category, nextRenewalDate, startDate, isRarelyUsed } = req.body;

  const result = db.prepare(`
    UPDATE subscriptions
    SET name = ?, cost = ?, billing_cycle = ?, category = ?, 
        next_renewal_date = ?, start_date = ?, is_rarely_used = ?
    WHERE id = ?
  `).run(name, cost, billingCycle, category, nextRenewalDate, startDate, isRarelyUsed ? 1 : 0, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  res.json({ id, ...req.body });
});


//DELETE
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  res.status(204).send();
});
export default router;