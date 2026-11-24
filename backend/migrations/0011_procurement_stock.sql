CREATE TABLE IF NOT EXISTS procurement_orders (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  supplier_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','issued','partial','fulfilled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  issued_by TEXT,
  issued_at TEXT,
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id)
);
CREATE TABLE IF NOT EXISTS procurement_order_lines (
  org_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK(units>0),
  unit_cost_paise INTEGER NOT NULL CHECK(unit_cost_paise>0),
  unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise>0),
  PRIMARY KEY(org_id,order_id,id),
  FOREIGN KEY(org_id,order_id) REFERENCES procurement_orders(org_id,id),
  FOREIGN KEY(org_id,sku_id) REFERENCES sku(org_id,id)
);
CREATE TABLE IF NOT EXISTS goods_receipts (
  org_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  expiry TEXT NOT NULL,
  received INTEGER NOT NULL CHECK(received>0),
  damaged INTEGER NOT NULL CHECK(damaged>=0 AND damaged<=received),
  invoice TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY(org_id,id),
  FOREIGN KEY(org_id,order_id,line_id) REFERENCES procurement_order_lines(org_id,order_id,id)
);
CREATE INDEX IF NOT EXISTS received_order_lines ON goods_receipts(org_id,order_id,line_id);

CREATE TRIGGER IF NOT EXISTS validate_stock_receipt BEFORE INSERT ON goods_receipts
BEGIN
  SELECT RAISE(ABORT,'ORDER_NOT_RECEIVABLE') WHERE NOT EXISTS (
    SELECT 1 FROM procurement_orders WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id AND id=NEW.order_id AND status IN ('issued','partial')
  );
  SELECT RAISE(ABORT,'RECEIPT_EXCEEDS_ORDER') WHERE NEW.received + COALESCE((
    SELECT SUM(received-damaged) FROM goods_receipts WHERE org_id=NEW.org_id AND order_id=NEW.order_id AND line_id=NEW.line_id
  ),0) > (SELECT units FROM procurement_order_lines WHERE org_id=NEW.org_id AND order_id=NEW.order_id AND id=NEW.line_id);
  SELECT RAISE(ABORT,'BATCH_CONFLICT') WHERE NEW.received>NEW.damaged AND EXISTS(
    SELECT 1 FROM procurement_order_lines l JOIN inventory_batches b ON b.org_id=l.org_id AND b.clinic_id=NEW.clinic_id
      AND b.sku_id=l.sku_id AND b.batch_no=NEW.batch_no
    WHERE l.org_id=NEW.org_id AND l.order_id=NEW.order_id AND l.id=NEW.line_id AND
      (b.expiry<>NEW.expiry OR b.cost_paise<>l.unit_cost_paise OR b.price_paise<>l.unit_price_paise)
  );
END;

-- Inventory is updated by the same D1 transaction that records the receipt.
CREATE TRIGGER IF NOT EXISTS receive_inventory_stock AFTER INSERT ON goods_receipts
BEGIN
  INSERT INTO inventory_batches(org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,price_paise,cost_paise)
  SELECT l.org_id,lower(hex(randomblob(16))),l.sku_id,NEW.clinic_id,NEW.batch_no,NEW.expiry,
    NEW.received-NEW.damaged,l.unit_price_paise,l.unit_cost_paise
  FROM procurement_order_lines l
  WHERE l.org_id=NEW.org_id AND l.order_id=NEW.order_id AND l.id=NEW.line_id AND NEW.received>NEW.damaged
  ON CONFLICT(org_id,clinic_id,sku_id,batch_no) DO UPDATE SET qty_units=inventory_batches.qty_units+excluded.qty_units;

  UPDATE procurement_orders SET status=CASE WHEN EXISTS(
    SELECT 1 FROM procurement_order_lines l WHERE l.org_id=NEW.org_id AND l.order_id=NEW.order_id
      AND l.units>COALESCE((SELECT SUM(r.received-r.damaged) FROM goods_receipts r
        WHERE r.org_id=l.org_id AND r.order_id=l.order_id AND r.line_id=l.id),0)
  ) THEN 'partial' ELSE 'fulfilled' END
  WHERE org_id=NEW.org_id AND clinic_id=NEW.clinic_id AND id=NEW.order_id;
END;
