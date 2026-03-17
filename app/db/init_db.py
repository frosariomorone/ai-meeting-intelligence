def init_db() -> None:
    """
    MongoDB is schemaless; for the MVP we rely on
    dynamic collection creation on first write.
    """
    return None


if __name__ == "__main__":
    init_db()

