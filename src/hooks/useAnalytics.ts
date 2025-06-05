
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useAnalytics = () => {
  const { data: stats, refetch } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      console.log('Fetching analytics stats...');
      
      const { data: batches, error } = await supabase
        .from('batches')
        .select('status, success_count, failure_count, processed_eids, average_processing_time_seconds');

      if (error) {
        console.error('Error fetching batches:', error);
        throw error;
      }

      console.log('Fetched batches:', batches);

      const activeBatches = batches?.filter(b => b.status === 'RUNNING').length || 0;
      const totalProcessed = batches?.reduce((sum, b) => sum + (b.processed_eids || 0), 0) || 0;
      const totalSuccess = batches?.reduce((sum, b) => sum + (b.success_count || 0), 0) || 0;
      const totalFailure = batches?.reduce((sum, b) => sum + (b.failure_count || 0), 0) || 0;
      const successRate = totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(1) : '0.0';

      // Calculate real average processing time
      const avgTimes = batches?.filter(b => b.average_processing_time_seconds && b.average_processing_time_seconds > 0)
        .map(b => b.average_processing_time_seconds) || [];
      const avgProcessingTime = avgTimes.length > 0 
        ? (avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length).toFixed(1) + 's'
        : '0.0s';

      const result = {
        activeBatches,
        successRate: `${successRate}%`,
        totalProcessed: totalProcessed > 1000 ? `${(totalProcessed / 1000).toFixed(1)}k` : totalProcessed.toString(),
        avgProcessing: avgProcessingTime
      };

      console.log('Analytics result:', result);
      return result;
    },
    refetchInterval: 5000, // Refetch every 5 seconds for near real-time updates
    retry: 1,
    retryDelay: 1000,
  });

  // Set up real-time subscriptions
  useEffect(() => {
    console.log('Setting up real-time subscriptions...');
    
    const batchesChannel = supabase
      .channel('batches-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'batches' },
        (payload) => {
          console.log('Batches changed:', payload);
          refetch();
        }
      )
      .subscribe();

    const resultsChannel = supabase
      .channel('results-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'esim_results' },
        (payload) => {
          console.log('Results changed:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(batchesChannel);
      supabase.removeChannel(resultsChannel);
    };
  }, [refetch]);

  return { stats };
};
