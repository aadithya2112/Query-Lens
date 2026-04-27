import {
  createDatabaseDatasetProfileStore,
  createFixtureDatasetProfileStore,
  type QueryLensDatasetProfileStore,
} from "@/lib/querylens/server/profile-store"
import {
  canUseDatabaseAdapter,
} from "@/lib/querylens/server/runtime-shared"
import {
  createDatabaseDataAccess,
  createFixtureDataAccess,
  type QueryLensDataAccess,
} from "@/lib/querylens/server/repositories"

export interface QueryLensDatasetRuntime {
  dataAccess: QueryLensDataAccess
  profileStore: QueryLensDatasetProfileStore
}

export async function getQueryLensDatasetRuntime(): Promise<QueryLensDatasetRuntime> {
  if (await canUseDatabaseAdapter()) {
    return {
      dataAccess: createDatabaseDataAccess(),
      profileStore: createDatabaseDatasetProfileStore(),
    }
  }

  return {
    dataAccess: createFixtureDataAccess(),
    profileStore: createFixtureDatasetProfileStore(),
  }
}

export async function getQueryLensDataAccess(): Promise<QueryLensDataAccess> {
  return (await getQueryLensDatasetRuntime()).dataAccess
}
