-- Customer's preferred service times, captured at submit (free alternative to
-- a third-party scheduler). e.g. "Weekday mornings, Weekends — after 3pm".
ALTER TABLE estimates ADD COLUMN preferred_times TEXT;
