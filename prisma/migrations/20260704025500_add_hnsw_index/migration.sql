-- knowledge_chunks 向量检索索引（余弦距离）
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON "knowledge_chunks" USING hnsw (embedding vector_cosine_ops);
