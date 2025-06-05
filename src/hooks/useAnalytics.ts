
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useAnalytics = () => {
  const { data: stats, refetch } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const { data: batches } = await supabase
        .from('batches')
        .select('status, success_count, failure_count, processed_eids, average_processing_time_seconds');

      const activeBatches = batches?.filter(b => b.status === 'RUNNING').length || 0;
      const totalProcessed = batches?.reduce((sum, b) => sum + b.processed_eids, 0) || 0;
      const totalSuccess = batches?.reduce((sum, b) => sum + b.success_count, 0) || 0;
      const totalFailure = batches?.reduce((sum, b) => sum + b.failure_count, 0) || 0;
      const successRate = totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(1) : '0.0';

      // Calculate real average processing time
      const avgTimes = batches?.filter(b => b.average_processing_time_seconds > 0)
        .map(b => b.average_processing_time_seconds) || [];
      const avgProcessingTime = avgTimes.length > 0 
        ? (avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length).toFixed(1) + 's'
        : '0.0s';

      return {
        activeBatches,
        successRate: `${successRate}%`,
        totalProcessed: totalProcessed > 1000 ? `${(totalProcessed / 1000).toFixed(1)}k` : totalProcessed.toString(),
        avgProcessing: avgProcessingTime
      };
    },
    refetchInterval: 5000 // Refetch every 5 seconds for near real-time updates
  });

  // Set up real-time subscriptions
  useEffect(() => {
    const batchesChannel = supabase
      .channel('batches-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'batches' },
        () => refetch()
      )
      .subscribe();

    const resultsChannel = supabase
      .channel('results-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'esim_results' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(batchesChannel);
      supabase.removeChannel(resultsChannel);
    };
  }, [refetch]);

  return { stats };
};
