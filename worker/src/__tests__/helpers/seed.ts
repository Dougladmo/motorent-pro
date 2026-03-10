import Database from 'better-sqlite3';

export interface SeedData {
  moto1Id: string;
  moto2Id: string;
  moto3Id: string;
  sub1Id: string;
  sub2Id: string;
  rental1Id: string;
  payment1Id: string;
  payment2Id: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function seedDb(db: Database.Database): SeedData {
  const now = new Date().toISOString();

  // IDs
  const moto1Id = generateUUID();
  const moto2Id = generateUUID();
  const moto3Id = generateUUID();
  const sub1Id = generateUUID();
  const sub2Id = generateUUID();
  const rental1Id = generateUUID();
  const payment1Id = generateUUID();
  const payment2Id = generateUUID();

  // Insert motorcycles
  const insertMoto = db.prepare(`
    INSERT INTO motorcycles (id, plate, model, year, status, image_url, total_revenue, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMoto.run(moto1Id, 'ABC1D23', 'Honda CG 160', 2022, 'Disponível', null, 0, now, now);
  insertMoto.run(moto2Id, 'XYZ9E87', 'Yamaha Factor 150', 2021, 'Alugada', null, 0, now, now);
  insertMoto.run(moto3Id, 'QQQ3F33', 'Honda Biz 125', 2020, 'Disponível', null, 0, now, now);

  // Insert subscribers (active stored as 1/0)
  const insertSub = db.prepare(`
    INSERT INTO subscribers (id, name, phone, email, document, active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSub.run(sub1Id, 'João Silva', '11999990001', 'joao@test.com', '11111111111', 1, null, now, now);
  insertSub.run(sub2Id, 'Maria Souza', '11999990002', 'maria@test.com', '22222222222', 1, null, now, now);

  // Insert rental (is_active stored as 1)
  db.prepare(`
    INSERT INTO rentals (id, motorcycle_id, subscriber_id, start_date, end_date, weekly_value, due_day_of_week, is_active, terminated_at, termination_reason, outstanding_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(rental1Id, moto2Id, sub1Id, '2026-01-01', null, 300, 1, 1, null, null, 0, now, now);

  // Insert payments (is_amount_overridden stored as 0)
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, rental_id, subscriber_name, amount, expected_amount, due_date, status, paid_at, marked_as_paid_at, previous_status, is_amount_overridden, reminder_sent_count, abacate_pix_id, pix_br_code, pix_expires_at, pix_payment_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(payment1Id, rental1Id, 'João Silva', 300, 300, '2026-01-01', 'Pago', '2026-01-01', now, 'Pendente', 0, 0, null, null, null, null, now, now);
  // payment2 uses a future date so terminateRental can cancel it
  insertPayment.run(payment2Id, rental1Id, 'João Silva', 300, 300, '2026-06-01', 'Pendente', null, null, null, 0, 0, null, null, null, null, now, now);

  return {
    moto1Id,
    moto2Id,
    moto3Id,
    sub1Id,
    sub2Id,
    rental1Id,
    payment1Id,
    payment2Id
  };
}
