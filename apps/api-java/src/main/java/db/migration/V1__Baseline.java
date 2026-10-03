package db.migration;

import java.sql.ResultSet;
import java.sql.Statement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * Creates the app's tables (the same schema the NestJS API creates with Prisma) on an EMPTY database.
 * If the tables already exist (the database was set up by Prisma) it does nothing, so both backends can share one database.
 */
public class V1__Baseline extends BaseJavaMigration {
  @Override
  public void migrate(Context context) throws Exception {
    try (Statement st = context.getConnection().createStatement();
        ResultSet rs = st.executeQuery("select to_regclass('public.\"Product\"') is not null")) {
      rs.next();
      if (rs.getBoolean(1)) return; // already created by Prisma
    }
    ScriptUtils.executeSqlScript(context.getConnection(), new ClassPathResource("db/schema/baseline.sql"));
  }
}
