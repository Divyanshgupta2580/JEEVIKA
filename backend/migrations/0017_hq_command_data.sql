CREATE TABLE command_organizations (
  org_id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  admin_email TEXT NOT NULL, branding_color TEXT NOT NULL,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL,
  FOREIGN KEY(org_id,created_by) REFERENCES users(org_id,id)
);

CREATE TABLE command_clinic_details (
  org_id TEXT NOT NULL, clinic_id TEXT NOT NULL, code TEXT, address TEXT, tier TEXT,
  bed_capacity INTEGER CHECK(bed_capacity>=0), manager_name TEXT, manager_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  PRIMARY KEY(org_id,clinic_id), UNIQUE(org_id,code),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,updated_by) REFERENCES users(org_id,id)
);

CREATE TABLE command_stock_transfers (
  org_id TEXT NOT NULL, id TEXT NOT NULL, actor_id TEXT NOT NULL, command_key TEXT NOT NULL, request_hash TEXT NOT NULL,
  source_clinic_id TEXT NOT NULL, destination_clinic_id TEXT NOT NULL, sku_id TEXT NOT NULL,
  source_batch_id TEXT NOT NULL, destination_batch_id TEXT NOT NULL,
  batch_no TEXT NOT NULL, expiry TEXT NOT NULL, unit_cost_paise INTEGER NOT NULL, unit_price_paise INTEGER NOT NULL,
  units INTEGER NOT NULL CHECK(typeof(units)='integer' AND units>0),
  reason TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(org_id,id), UNIQUE(org_id,actor_id,command_key),
  CHECK(source_clinic_id<>destination_clinic_id),
  FOREIGN KEY(org_id,actor_id) REFERENCES users(org_id,id),
  FOREIGN KEY(org_id,source_clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,destination_clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,sku_id) REFERENCES sku(org_id,id),
  FOREIGN KEY(org_id,source_batch_id) REFERENCES inventory_batches(org_id,id),
  FOREIGN KEY(org_id,destination_batch_id) REFERENCES inventory_batches(org_id,id)
);
CREATE INDEX command_stock_transfers_time ON command_stock_transfers(org_id,created_at);

CREATE TABLE command_stock_movements (
  org_id TEXT NOT NULL, transfer_id TEXT NOT NULL, clinic_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK(typeof(units)='integer' AND units<>0),
  PRIMARY KEY(org_id,transfer_id,batch_id),
  FOREIGN KEY(org_id,transfer_id) REFERENCES command_stock_transfers(org_id,id),
  FOREIGN KEY(org_id,clinic_id) REFERENCES clinics(org_id,id),
  FOREIGN KEY(org_id,batch_id) REFERENCES inventory_batches(org_id,id)
);

CREATE TRIGGER apply_command_stock_transfer AFTER INSERT ON command_stock_transfers BEGIN
  SELECT RAISE(ABORT,'TRANSFER_CLINIC_PAUSED') WHERE EXISTS (
    SELECT 1 FROM command_clinic_details d WHERE d.org_id=NEW.org_id
      AND d.clinic_id IN (NEW.source_clinic_id,NEW.destination_clinic_id) AND d.status='paused'
  );
  UPDATE inventory_batches SET qty_units=qty_units-NEW.units
    WHERE org_id=NEW.org_id AND clinic_id=NEW.source_clinic_id AND id=NEW.source_batch_id
      AND sku_id=NEW.sku_id AND batch_no=NEW.batch_no AND expiry=NEW.expiry
      AND cost_paise=NEW.unit_cost_paise AND price_paise=NEW.unit_price_paise
      AND expiry>=date('now','+330 minutes') AND qty_units-reserved_units>=NEW.units;
  SELECT RAISE(ABORT,'TRANSFER_STOCK_UNAVAILABLE') WHERE changes()<>1;
  INSERT INTO inventory_batches(org_id,id,sku_id,clinic_id,batch_no,expiry,qty_units,price_paise,cost_paise)
    VALUES(NEW.org_id,NEW.destination_batch_id,NEW.sku_id,NEW.destination_clinic_id,NEW.batch_no,NEW.expiry,
      NEW.units,NEW.unit_price_paise,NEW.unit_cost_paise)
    ON CONFLICT(org_id,clinic_id,sku_id,batch_no) DO UPDATE SET qty_units=qty_units+excluded.qty_units
      WHERE id=excluded.id AND expiry=excluded.expiry AND price_paise=excluded.price_paise AND cost_paise=excluded.cost_paise;
  SELECT RAISE(ABORT,'TRANSFER_DESTINATION_BATCH_CONFLICT') WHERE changes()<>1;
  INSERT INTO command_stock_movements(org_id,transfer_id,clinic_id,batch_id,units) VALUES
    (NEW.org_id,NEW.id,NEW.source_clinic_id,NEW.source_batch_id,-NEW.units),
    (NEW.org_id,NEW.id,NEW.destination_clinic_id,NEW.destination_batch_id,NEW.units);
END;
CREATE TRIGGER command_transfer_immutable BEFORE UPDATE ON command_stock_transfers BEGIN
  SELECT RAISE(ABORT,'TRANSFER_IMMUTABLE');
END;
CREATE TRIGGER command_transfer_no_delete BEFORE DELETE ON command_stock_transfers BEGIN
  SELECT RAISE(ABORT,'TRANSFER_IMMUTABLE');
END;
CREATE TRIGGER command_transfer_movement_immutable BEFORE UPDATE ON command_stock_movements BEGIN
  SELECT RAISE(ABORT,'TRANSFER_IMMUTABLE');
END;
CREATE TRIGGER command_transfer_movement_no_delete BEFORE DELETE ON command_stock_movements BEGIN
  SELECT RAISE(ABORT,'TRANSFER_IMMUTABLE');
END;
