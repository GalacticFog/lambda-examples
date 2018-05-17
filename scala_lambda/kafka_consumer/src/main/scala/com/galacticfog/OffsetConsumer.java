package com.galacticfog;

import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collection;
import java.util.Map;

public class OffsetConsumer implements ConsumerRebalanceListener
{
    private Consumer<?,?> consumer;
    private Map<Integer, Long> offsets;

    Logger log = LoggerFactory.getLogger( getClass() );

    public OffsetConsumer( Consumer<?,?> consumer, Map<Integer, Long> offsets )
    {
        this.consumer = consumer;
        this.offsets = offsets;
    }

    public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
        for( TopicPartition partition : partitions ) {
            log.debug("partition revoked : " + partition.topic() + " - " + partition.partition() );
        }
    }

    public void onPartitionsAssigned( Collection<TopicPartition> partitions ) {
        log.debug( "onPartitionsAssigned() : {}", partitions.size() );

        // read the offsets from an external store using some custom code not described here
        for(TopicPartition partition: partitions) {
            log.debug( "Partition {}", partition.partition() );
            if( offsets.containsKey( partition.partition() ) ) {
                Long offset = offsets.get( partition.partition() );
                log.debug( "Seeking partition {} to {}", partition.partition(), offset );
                consumer.seek( partition, offsets.get( offset ) );
            }
            else {
                log.debug("offsets doesn't container key {}", partition.partition() );
                log.debug(" offsets : " );

                for(Integer part : offsets.keySet() ) {
                    log.debug( "\t{} -> {}", part, offsets.get( part ) );
                }
            }
        }
    }
}
